import { join } from 'node:path';

import { InferenceSession, Tensor } from 'onnxruntime-node';

import { download, type Fetch } from './download.js';

/** Silero VAD v5 (MIT), pinned version from the official repository. About 2 MB. */
export const SILERO = {
  url: 'https://huggingface.co/onnx-community/silero-vad/resolve/e71cae966052b992a7eca6b17738916ce0eca4ec/onnx/model.onnx',
  sha256: 'a4a068cd6cf1ea8355b84327595838ca748ec29a25bc91fc82e6c299ccdc5808',
  size: 2243022,
};

/**
 * Silero works on blocks of 512 samples (32 ms at 16 kHz), with 64 samples of context from the previous
 * block.
 */
const CHUNK = 512;
const CONTEXT = 64;
/** A sentence has real voice if Silero hears voice for at least this long. */
export const MIN_SPEECH_MS = 250;

/**
 * Whether there is human voice in this audio. Works for any language: it checks whether someone talks, not
 * what is said.
 */
export interface SpeechCheck {
  hasSpeech(audio: Float32Array): Promise<boolean>;
}

/** Milliseconds of voice, from the voice probability of each block. */
export function speechMs(probabilities: number[]): number {
  return probabilities.filter((p) => p > 0.5).length * ((CHUNK / 16_000) * 1000);
}

/**
 * Silero VAD: a small model that tells human voice from noise. Every sentence goes through it before Whisper,
 * and noise is not transcribed (Whisper would make something up). Downloaded once to cacheDir.
 */
export async function createSileroCheck({ cacheDir, fetchImpl }: { cacheDir: string; fetchImpl?: Fetch }): Promise<SpeechCheck> {
  const model = await download(SILERO.url, join(cacheDir, 'silero-vad', 'model.onnx'), SILERO, fetchImpl);
  const session = await InferenceSession.create(model);
  const sr = new Tensor('int64', BigInt64Array.from([16_000n]), []);

  return {
    /**
     * Stops as soon as there is enough voice: each step waits its turn in ONNX Runtime behind Whisper or Smart Turn, so
     * going through the whole sentence could take tens of seconds.
     */
    async hasSpeech(audio) {
      let state: Tensor = new Tensor('float32', new Float32Array(2 * 128), [2, 1, 128]);
      let context = new Float32Array(CONTEXT);
      const probabilities: number[] = [];
      for (let i = 0; i + CHUNK <= audio.length && speechMs(probabilities) < MIN_SPEECH_MS; i += CHUNK) {
        const chunk = audio.subarray(i, i + CHUNK);
        const input = new Float32Array(CONTEXT + CHUNK);
        input.set(context, 0);
        input.set(chunk, CONTEXT);
        context = chunk.slice(CHUNK - CONTEXT);
        const out = await session.run({ input: new Tensor('float32', input, [1, input.length]), state, sr });
        state = out['stateN'] as Tensor;
        probabilities.push((out['output'] as Tensor).data[0] as number);
      }
      return speechMs(probabilities) >= MIN_SPEECH_MS;
    },
  };
}
