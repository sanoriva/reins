/**
 * Detects whether the user talks while the AI is talking. The microphone also hears the AI's voice from the
 * speakers (its echo), so hearing a voice is not enough: the microphone level is compared with what is
 * playing. This is the Geigel double-talk detector used by hands-free phones: if the microphone hears clearly
 * more than can come back from the speaker, someone else is talking.
 */

/**
 * At the start of each AI sentence, how long to learn how much of its voice comes back through the
 * microphone.
 */
export const LEARN_MS = 500;
/** It is the user if the microphone hears at least this many times what comes back from the speaker… */
export const USER_FACTOR = 2;
/** …for this long without a break (7 blocks of 30 ms), so a single knock does not cut the AI off. */
export const MIN_USER_MS = 210;
/**
 * What plays reaches the microphone with some delay, and the time each chunk plays is approximate (ffplay
 * takes a while to start), so the loudest level within this window is used.
 */
const WINDOW_BEFORE_MS = 600;
const WINDOW_AFTER_MS = 200;

interface Played {
  at: number;
  level: number;
}

export class EchoGate {
  private played: Played[] = [];
  private learnUntil = 0;
  private ratios: number[] = [];
  /**
   * How much of the AI's voice comes back through the microphone (0 while unknown). It lasts the whole
   * conversation.
   */
  private coupling = 0;
  private userFrames = 0;
  /** Without anything played yet (e.g. with the system voice) there is no way to tell what is echo. */
  private heardAI = false;

  /** A chunk about to play: its level and when it plays. `first` marks the first chunk of a sentence. */
  play(level: number, at: number, first = false): void {
    if (first) {
      this.learnUntil = at + LEARN_MS;
      this.userFrames = 0;
    }
    this.played.push({ at, level });
    this.heardAI = true;
  }

  /**
   * Takes a 30 ms microphone block while the AI talks, with its level and the room's voice threshold. Returns
   * true once the user has been talking above the echo for MIN_USER_MS.
   */
  mic(level: number, now: number, floor: number): boolean {
    if (!this.heardAI) return false;
    this.played = this.played.filter((p) => p.at > now - 2 * WINDOW_BEFORE_MS);
    let far = 0;
    for (const p of this.played) if (p.at >= now - WINDOW_BEFORE_MS && p.at <= now + WINDOW_AFTER_MS) far = Math.max(far, p.level);

    if (now < this.learnUntil && far > 0) {
      this.ratios.push(level / far);
      return false;
    }
    if (this.ratios.length) this.learn();

    const echo = this.coupling * far;
    const user = level > floor && level > USER_FACTOR * echo;
    this.userFrames = user ? this.userFrames + 1 : 0;
    return this.userFrames * 30 >= MIN_USER_MS;
  }

  /**
   * Learns from the start of the sentence: the loudest level that came back, ignoring the top 10 % in case of
   * a knock. It rises at once and falls slowly, because underestimating it would make the AI cut itself off
   * with its own echo.
   */
  private learn(): void {
    const sorted = [...this.ratios].sort((a, b) => a - b);
    const measured = sorted[Math.floor(sorted.length * 0.9)] ?? sorted.at(-1)!;
    this.coupling = measured >= this.coupling ? measured : 0.9 * this.coupling + 0.1 * measured;
    this.ratios = [];
  }
}
