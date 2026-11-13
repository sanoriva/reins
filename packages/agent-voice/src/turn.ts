import { join } from 'node:path';

import { WhisperFeatureExtractor } from '@huggingface/transformers';
import { InferenceSession, Tensor } from 'onnxruntime-node';

import { download, type Fetch } from './download.js';

/** Smart Turn v3.2 (BSD-2, Pipecat), pinned version from the official repository. About 8 MB, CPU. */
export const SMART_TURN = {
  url: 'https://huggingface.co/pipecat-ai/smart-turn-v3/resolve/f766f81d3cfdf7737ac64aad813d91bbfd56bf93/smart-turn-v3.2-cpu.onnx',
  sha256: '2bb026316b14a660486a75b1733cd3fbab8c2fd0314dc9af7be49f8cca967e4f',
  size: 8679182,
};

/** Smart Turn looks at the last 8 s of the turn, at 16 kHz. */
const SECONDS = 8;
const SAMPLES = SECONDS * 16_000;
/** Above this probability the user has finished talking (Smart Turn's own threshold). */
export const TURN_COMPLETE = 0.5;

/**
 * Whether the user has finished their turn or is only pausing. It looks at intonation, not words, so it works
 * for 23 languages.
 */
export interface TurnCheck {
  /** Probability (0 to 1) that the user has finished. */
  complete(audio: Float32Array): Promise<number>;
}

/**
 * Prepared as Smart Turn expects: the last 8 s (zero-padded in front when shorter), normalised to mean 0 and
 * variance 1, as the Whisper feature extractor does with do_normalize.
 */
export function prepareTurnAudio(audio: Float32Array): Float32Array {
  const out = new Float32Array(SAMPLES);
  const tail = audio.length > SAMPLES ? audio.subarray(audio.length - SAMPLES) : audio;
  out.set(tail, SAMPLES - tail.length);
  let mean = 0;
  for (const s of out) mean += s;
  mean /= out.length;
  let variance = 0;
  for (const s of out) variance += (s - mean) ** 2;
  const scale = 1 / Math.sqrt(variance / out.length + 1e-7);
  for (let i = 0; i < out.length; i++) out[i] = (out[i]! - mean) * scale;
  return out;
}

/**
 * Smart Turn: downloaded once to cacheDir and run locally in a few tens of milliseconds. Its input is the same Whisper
 * log-mel (80 bands), for 8 s instead of 30.
 */
export async function createTurnCheck({ cacheDir, fetchImpl }: { cacheDir: string; fetchImpl?: Fetch }): Promise<TurnCheck> {
  const model = await download(SMART_TURN.url, join(cacheDir, 'smart-turn', 'smart-turn-v3.2-cpu.onnx'), SMART_TURN, fetchImpl);
  const session = await InferenceSession.create(model);
  const features = new WhisperFeatureExtractor({
    feature_size: 80,
    sampling_rate: 16_000,
    hop_length: 160,
    n_fft: 400,
    chunk_length: SECONDS,
    n_samples: SAMPLES,
    nb_max_frames: SAMPLES / 160,
  });
  const input = session.inputNames[0]!;
  const output = session.outputNames[0]!;

  return {
    async complete(audio) {
      const { input_features } = (await features(prepareTurnAudio(audio))) as { input_features: { data: Float32Array; dims: number[] } };
      const result = await session.run({ [input]: new Tensor('float32', input_features.data, input_features.dims) });
      return (result[output] as Tensor).data[0] as number;
    },
  };
}
