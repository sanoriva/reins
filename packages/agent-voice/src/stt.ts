import { type AutomaticSpeechRecognitionPipeline, env, pipeline, Tensor } from '@huggingface/transformers';

import { type Log, silent } from './log.js';

/** Speech to text. */
export interface Transcriber {
  transcribe(audio: Float32Array): Promise<string>;
}

/** small: much more accurate than base in Spanish (≈3 s per sentence on CPU, 241 MB). */
export const DEFAULT_WHISPER_MODEL = 'onnx-community/whisper-small';
/** The commit of DEFAULT_WHISPER_MODEL this package was tested with, so its files cannot change under the user. */
export const DEFAULT_WHISPER_REVISION = '36050c46d777d46dc4b5f43f6d90574fc38f8732';

export interface WhisperOptions {
  model?: string;
  /** A 2-letter code to fix the language; without it, the language of each sentence is detected. */
  language?: string;
  cacheDir: string;
  /**
   * `cpu`, or `dml` (the graphics card on Windows, through DirectML: ~25 % faster). If dml fails, cpu is
   * used.
   */
  device?: WhisperDevice;
  log?: Log;
}

export type WhisperDevice = 'cpu' | 'dml';

/** On Windows the graphics card (DirectML ships with ONNX Runtime); elsewhere the CPU. */
export const defaultDevice = (platform: NodeJS.Platform = process.platform): WhisperDevice => (platform === 'win32' ? 'dml' : 'cpu');

interface WhisperGenerationConfig {
  decoder_start_token_id: number;
  lang_to_id: Record<string, number>;
}

/**
 * The most likely language after <|startoftranscript|>, as the original Whisper does. transformers.js does
 * not detect it (without a language it assumes English and "transcribes" by translating), so it is done here.
 */
export function mostLikelyLanguage(logits: Pick<Tensor, 'dims' | 'data'>, langToId: Record<string, number>): string {
  const vocab = logits.dims.at(-1)!;
  const data = logits.data as Float32Array;
  const row = data.subarray(data.length - vocab);
  let best = 'en';
  let score = -Infinity;
  for (const [token, id] of Object.entries(langToId)) {
    if (row[id]! > score) [best, score] = [token.slice(2, -2), row[id]!];
  }
  return best;
}

/**
 * Local Whisper with transformers.js. The model is downloaded once; afterwards everything works offline. The first
 * sentence on the graphics card is much slower (it compiles its kernels), so that cost is paid at startup.
 */
export async function createWhisper(options: WhisperOptions): Promise<Transcriber> {
  const log = options.log ?? silent;
  const device = options.device ?? 'cpu';
  let transcriber: Transcriber;
  let used = device;
  try {
    transcriber = await loadWhisper(options, device, log);
  } catch (error) {
    if (device === 'cpu') throw error;
    log(`[whisper] cannot use ${device} (${(error as Error).message}); using the CPU`);
    transcriber = await loadWhisper(options, 'cpu', log);
    used = 'cpu';
  }
  const started = Date.now();
  await transcriber.transcribe(new Float32Array(16_000));
  log(`[whisper] ready on ${used} (${Date.now() - started} ms warm-up)`);
  return transcriber;
}

/**
 * Loads Whisper on a device. With a fixed language, it only transcribes. Otherwise it detects the language and
 * transcribes with a single encoder pass (the slowest part) through an internal transformers.js function, which is why
 * that package's version is pinned; the public path would encode twice.
 */
async function loadWhisper({ model = DEFAULT_WHISPER_MODEL, language, cacheDir }: WhisperOptions, device: WhisperDevice, log: Log): Promise<Transcriber> {
  env.cacheDir = cacheDir;
  const asr = (await pipeline('automatic-speech-recognition', model, { dtype: 'q8', device, ...(model === DEFAULT_WHISPER_MODEL ? { revision: DEFAULT_WHISPER_REVISION } : {}) })) as AutomaticSpeechRecognitionPipeline;
  const config = asr.model.generation_config as unknown as WhisperGenerationConfig;
  const start = () => new Tensor('int64', BigInt64Array.from([BigInt(config.decoder_start_token_id)]), [1, 1]);

  const transcribeIn = async (audio: Float32Array, lang: string) => {
    const started = Date.now();
    const output = await asr(audio, { task: 'transcribe', language: lang, max_new_tokens: maxTokens(audio) }).catch((error: Error) => {
      if (NO_WORDS.test(error.message)) return { text: '' };
      throw error;
    });
    log(`[whisper] ${lang} · ${Date.now() - started} ms`);
    return (Array.isArray(output) ? output.map((o) => o.text).join(' ') : output.text).trim();
  };

  if (language) return { transcribe: (audio) => transcribeIn(audio, language) };

  const model_ = asr.model as unknown as {
    _prepare_encoder_decoder_kwargs_for_generation?: (args: object) => Promise<{ encoder_outputs: Tensor }>;
    generate(args: object): Promise<Tensor>;
    (inputs: object): Promise<{ logits: Tensor }>;
  };
  return {
    async transcribe(audio) {
      const started = Date.now();
      const { input_features } = (await asr.processor(audio)) as { input_features: Tensor };
      if (!model_._prepare_encoder_decoder_kwargs_for_generation) {
        const { logits } = await model_({ input_features, decoder_input_ids: start() });
        return transcribeIn(audio, mostLikelyLanguage(logits, config.lang_to_id));
      }
      const { encoder_outputs } = await model_._prepare_encoder_decoder_kwargs_for_generation({
        inputs_tensor: input_features,
        model_inputs: { input_features },
        model_input_name: 'input_features',
        generation_config: asr.model.generation_config,
      });
      const { logits } = await model_({ encoder_outputs, decoder_input_ids: start() });
      const lang = mostLikelyLanguage(logits, config.lang_to_id);
      const detected = Date.now();
      const ids = await model_.generate({ inputs: input_features, encoder_outputs, language: lang, task: 'transcribe', max_new_tokens: maxTokens(audio) });
      log(`[whisper] idioma detectado: ${lang} (${detected - started} ms) · transcribir ${Date.now() - detected} ms`);
      return (asr.tokenizer.batch_decode(ids, { skip_special_tokens: true })[0] ?? '').trim();
    },
  };
}

/** Nobody speaks faster than about 8 tokens a second: a longer output is Whisper looping on noise, so it is cut there. */
export const maxTokens = (audio: Float32Array): number => Math.ceil((audio.length / 16_000) * 8) + 8;

/** When Whisper hears no words at all, transformers.js fails to decode the empty result instead of returning "". */
const NO_WORDS = /token_ids must be a non-empty array/;
