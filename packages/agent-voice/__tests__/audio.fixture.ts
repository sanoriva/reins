import { FRAME_SAMPLES } from '../src/vad.js';

/** A 30 ms block with a tone of the given amplitude (0 = silence). */
export function frame(amplitude: number): Float32Array {
  return Float32Array.from({ length: FRAME_SAMPLES }, (_, i) => amplitude * Math.sin(i / 3));
}

/** Blocks → 16-bit PCM, as ffmpeg delivers it. */
export function pcm(frames: Float32Array[]): Buffer {
  const out = Buffer.alloc(frames.length * FRAME_SAMPLES * 2);
  frames.forEach((f, n) => f.forEach((s, i) => out.writeInt16LE(Math.round(s * 32_767), (n * FRAME_SAMPLES + i) * 2)));
  return out;
}

export const silence = (count: number) => Array.from({ length: count }, () => frame(0.002));
export const voice = (count: number) => Array.from({ length: count }, () => frame(0.3));
