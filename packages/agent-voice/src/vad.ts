import { SAMPLE_RATE } from './mic.js';

/** The detector works on 30 ms blocks. */
export const FRAME_SAMPLES = (SAMPLE_RATE * 30) / 1000;

export interface VadOptions {
  /** Consecutive voice blocks to decide the user started talking (90 ms). */
  startFrames?: number;
  /**
   * Consecutive silent blocks to decide they finished (1.5 s, so short pauses while talking do not split the
   * sentence).
   */
  endFrames?: number;
  /** Blocks kept from before the start, so the first syllable is not cut (0.3 s). */
  preRollFrames?: number;
  /** A sentence lasts at most 20 s. */
  maxFrames?: number;
  /** Minimum energy threshold, and how many times the background noise the voice must exceed. */
  minThreshold?: number;
  noiseFactor?: number;
}

export type VadState = 'waiting' | 'speaking' | 'done';

const rms = (frame: Float32Array) => {
  let sum = 0;
  for (const sample of frame) sum += sample * sample;
  return Math.sqrt(sum / frame.length);
};

/** Initial blocks that only measure the room noise (0.3 s). */
const CALIBRATION_FRAMES = 10;
/** How fast the noise level rises per block when it gets louder: slowly (about 3 s to adapt). */
const NOISE_RISE = 0.01;
/** How fast it falls when it gets quieter: quickly, so silence brings it back at once. */
const NOISE_FALL = 0.5;

/**
 * Energy-based voice detection. The room noise level lasts the whole conversation (it is not reset on every
 * sentence): it falls fast with silence and rises very slowly, so voice is never mistaken for noise.
 */
export class VoiceDetector {
  private readonly o: Required<VadOptions>;
  private state: VadState = 'waiting';
  private noise = 0;
  private calibrated = 0;
  private loud = 0;
  private quiet = 0;
  private voicedFrames = 0;
  private readonly preRoll: Float32Array[] = [];
  private frames: Float32Array[] = [];

  constructor(options: VadOptions = {}) {
    this.o = {
      startFrames: 3,
      endFrames: 50,
      preRollFrames: 10,
      maxFrames: Math.round((20 * SAMPLE_RATE) / FRAME_SAMPLES),
      minThreshold: 0.01,
      noiseFactor: 2,
      ...options,
    };
  }

  get threshold(): number {
    return Math.max(this.o.minThreshold, this.noise * this.o.noiseFactor);
  }

  get current(): VadState {
    return this.state;
  }

  /** Consecutive silent blocks since the last voice of the current sentence. */
  get quietFrames(): number {
    return this.quiet;
  }

  /** How much of the sentence had real voice (above the threshold), in milliseconds. */
  get voicedMs(): number {
    return this.voicedFrames * 30;
  }

  /**
   * `learnNoise` is false while the AI talks: its echo is not room noise, and learning it would make the user
   * inaudible. When the microphone opens, the first 0.3 s only measure the room noise.
   */
  push(frame: Float32Array, learnNoise = true): VadState {
    if (this.state === 'done') return this.state;
    const energy = rms(frame);
    if (this.calibrated < CALIBRATION_FRAMES) {
      this.calibrated++;
      this.noise += (energy - this.noise) / this.calibrated;
      this.preRoll.push(frame);
      return this.state;
    }
    const loud = energy > this.threshold;
    if (learnNoise) this.noise += (energy - this.noise) * (energy < this.noise ? NOISE_FALL : NOISE_RISE);

    if (this.state === 'waiting') {
      this.preRoll.push(frame);
      if (this.preRoll.length > this.o.preRollFrames) this.preRoll.shift();
      this.loud = loud ? this.loud + 1 : 0;
      if (this.loud >= this.o.startFrames) {
        this.state = 'speaking';
        this.frames = [...this.preRoll];
        this.voicedFrames = this.loud;
        this.preRoll.length = 0;
      }
      return this.state;
    }

    this.frames.push(frame);
    if (loud) this.voicedFrames++;
    this.quiet = loud ? 0 : this.quiet + 1;
    if (this.quiet >= this.o.endFrames || this.frames.length >= this.o.maxFrames) this.state = 'done';
    return this.state;
  }

  /** The whole sentence, including the chunk from before the start. */
  utterance(): Float32Array {
    const out = new Float32Array(this.frames.reduce((n, f) => n + f.length, 0));
    let offset = 0;
    for (const frame of this.frames) {
      out.set(frame, offset);
      offset += frame.length;
    }
    return out;
  }

  /** Keeps only the last blocks of the current sentence (what came before was the AI's voice). */
  keepLast(frames: number): void {
    if (this.frames.length <= frames) return;
    this.frames = this.frames.slice(-frames);
    this.voicedFrames = Math.min(this.voicedFrames, frames);
  }

  /** On to the next sentence. The learned noise level is kept. */
  next(): void {
    this.state = 'waiting';
    this.frames = [];
    this.loud = 0;
    this.quiet = 0;
    this.voicedFrames = 0;
  }
}
