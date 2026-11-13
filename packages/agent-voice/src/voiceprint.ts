import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Same voice measured 0.89 and different voices 0.35 in tests, so this leaves room for a different microphone. */
export const SAME_SPEAKER = 0.55;
export const ENROLL_SENTENCES = 3;
/** Shorter than this, the model cannot tell voices apart, so a short "yes" or "stop" always passes. */
export const MIN_JUDGE_MS = 700;
export const MIN_LEARN_MS = 1500;
/** The voiceprint keeps adapting (a new microphone, a cold), weighting at most the last 50 sentences. */
const MAX_WEIGHT = 50;

export interface StoredVoiceprint {
  embedding: number[];
  sentences: number;
}

export interface VoiceprintStore {
  load(): StoredVoiceprint | undefined;
  save(voiceprint: StoredVoiceprint): void;
}

export function similarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! ** 2;
    nb += b[i]! ** 2;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const normalize = (v: ArrayLike<number>) => {
  const norm = Math.sqrt(Array.from(v).reduce((sum, x) => sum + x * x, 0)) || 1;
  return Array.from(v, (x) => x / norm);
};

/**
 * The user's voice, learned once from their first sentences and kept between conversations. While learning, every
 * sentence passes; a sentence that does not sound like the ones learned so far is not learned.
 */
export class Voiceprint {
  private stored: StoredVoiceprint | undefined;

  constructor(private readonly store: VoiceprintStore) {
    this.stored = store.load();
  }

  get ready(): boolean {
    return (this.stored?.sentences ?? 0) >= ENROLL_SENTENCES;
  }

  /** Only sentences the user started on their own are learned: one that began while the AI talked carries its echo. */
  judge(embedding: ArrayLike<number>, voicedMs: number, learnable: boolean): { user: boolean; similarity?: number } {
    const score = this.stored ? similarity(this.stored.embedding, embedding) : undefined;
    const alike = score === undefined || score >= SAME_SPEAKER;
    const user = this.ready ? alike : true;
    if (alike && learnable && voicedMs >= MIN_LEARN_MS) this.learn(embedding);
    return { user, ...(score === undefined ? {} : { similarity: score }) };
  }

  private learn(embedding: ArrayLike<number>): void {
    const next = normalize(embedding);
    const old = this.stored;
    const weight = Math.min(old?.sentences ?? 0, MAX_WEIGHT);
    const mean = old ? old.embedding.map((x, i) => (x * weight + next[i]!) / (weight + 1)) : next;
    this.stored = { embedding: normalize(mean), sentences: (old?.sentences ?? 0) + 1 };
    this.store.save(this.stored);
  }
}

/** Readable only by the user: it identifies their voice. */
export function voiceprintFile(path: string): VoiceprintStore & { forget(): void } {
  return {
    load() {
      try {
        const data = JSON.parse(readFileSync(path, 'utf8')) as StoredVoiceprint;
        return Array.isArray(data.embedding) && Number.isInteger(data.sentences) ? data : undefined;
      } catch {
        return undefined;
      }
    },
    save(voiceprint) {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      writeFileSync(path, JSON.stringify(voiceprint), { mode: 0o600 });
      chmodSync(path, 0o600);
    },
    forget() {
      if (existsSync(path)) rmSync(path);
    },
  };
}
