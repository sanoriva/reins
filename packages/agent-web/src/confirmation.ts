import { ProtocolErrorCode } from '@reins-ai/contract';

import { ActionError } from './action.js';

export const CODE_LENGTH = 4;
export const CODE_TTL_MS = 60_000;
export const MAX_ATTEMPTS = 3;
/** The first lock after MAX_ATTEMPTS wrong codes in a row; each further lock doubles, up to LOCK_MAX_MS. */
export const LOCK_FIRST_MS = 60_000;
export const LOCK_MAX_MS = 60 * 60_000;
/** Error code of a submission requested while a lock is active. */
export const TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS';

/** A line of the summary shown next to the code: the field's description and the value to be sent. */
export interface SummaryLine {
  label: string;
  value: string;
}

/**
 * What the app shows the user. The code only exists here: it never travels over the channel, so the AI cannot
 * know or guess it and has to ask the user.
 */
export type ConfirmationState =
  | { status: 'none' }
  | { status: 'pending'; form: string; code: string; summary: SummaryLine[]; expiresAt: number; attemptsLeft: number };

export function randomCode(digits = CODE_LENGTH): string {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return String((n ?? 0) % 10 ** digits).padStart(digits, '0');
}

interface Pending {
  form: string;
  code: string;
  summary: SummaryLine[];
  expiresAt: number;
  attemptsLeft: number;
  send: () => unknown;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * The submission waiting for its code. One at a time: a new request replaces the previous one. It is
 * cancelled when it expires (60 s), after 3 wrong attempts or on screen change.
 *
 * Wrong codes are also counted in a row across requests, so asking for a new code does not grant new guesses:
 * every MAX_ATTEMPTS wrong codes in a row lock new requests for LOCK_FIRST_MS, doubling each time up to
 * LOCK_MAX_MS. Only a right code clears the count; a screen change does not, so navigating cannot lift a lock.
 */
export class Confirmation {
  private pending: Pending | undefined;
  private failures = 0;
  private lockedUntil = 0;
  private nextLockMs = LOCK_FIRST_MS;

  constructor(
    private readonly onChange: (state: ConfirmationState) => void,
    private readonly newCode: () => string = randomCode,
  ) {}

  get state(): ConfirmationState {
    const p = this.pending;
    return p
      ? { status: 'pending', form: p.form, code: p.code, summary: p.summary, expiresAt: p.expiresAt, attemptsLeft: p.attemptsLeft }
      : { status: 'none' };
  }

  /** Shows a new code for a submission. While a lock is active it refuses with TOO_MANY_ATTEMPTS instead. */
  request(form: string, summary: SummaryLine[], send: () => unknown): void {
    const wait = this.lockedUntil - Date.now();
    if (wait > 0) {
      throw new ActionError(
        TOO_MANY_ATTEMPTS,
        `Too many wrong codes in a row: no new code can be requested for ${Math.ceil(wait / 1000)} s. Tell the user.`,
      );
    }
    this.clear();
    this.pending = {
      form,
      code: this.newCode(),
      summary,
      expiresAt: Date.now() + CODE_TTL_MS,
      attemptsLeft: MAX_ATTEMPTS,
      send,
      timer: setTimeout(() => this.cancel(), CODE_TTL_MS),
    };
    this.onChange(this.state);
  }

  /** Transcriptions may put spaces or dashes between the digits. */
  async confirm(said: string): Promise<unknown> {
    const p = this.pending;
    if (!p) throw new ActionError(ProtocolErrorCode.NOT_AVAILABLE, 'No submission is waiting for confirmation');
    if (said.replace(/\D/g, '') !== p.code) {
      p.attemptsLeft -= 1;
      this.failures += 1;
      if (this.failures % MAX_ATTEMPTS === 0) {
        this.lockedUntil = Date.now() + this.nextLockMs;
        this.nextLockMs = Math.min(this.nextLockMs * 2, LOCK_MAX_MS);
      }
      if (p.attemptsLeft === 0) {
        this.cancel();
        throw new ActionError(ProtocolErrorCode.INVALID_CODE, 'Wrong code. No attempts left: the submission was cancelled', 0);
      }
      this.onChange(this.state);
      throw new ActionError(ProtocolErrorCode.INVALID_CODE, 'Wrong code: ask the user to read it again from the screen', p.attemptsLeft);
    }
    this.failures = 0;
    this.nextLockMs = LOCK_FIRST_MS;
    this.cancel();
    return p.send();
  }

  cancel(): void {
    if (!this.pending) return;
    this.clear();
    this.onChange(this.state);
  }

  private clear(): void {
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = undefined;
  }
}
