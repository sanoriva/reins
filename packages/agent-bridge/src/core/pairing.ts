import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { Connection, Tokens, TokenStore } from './ports.js';

export const CODE_TTL_MS = 2 * 60_000;
/** Consecutive failures before every waiting tab is asked for a new code. */
export const MAX_FAILURES = 5;
/** After MAX_FAILURES wrong codes in a row, pair_tab is locked for LOCK_FIRST_MS, doubling each time up to LOCK_MAX_MS. */
export const LOCK_FIRST_MS = 60_000;
export const LOCK_MAX_MS = 60 * 60_000;

/**
 * `wrong`: no waiting tab has that code. `expired`: it matched but had expired, and the page is already
 * generating a new one. `none`: no tab is waiting.
 */
export type PairResult = { ok: true; tabId: string } | { ok: false; reason: 'wrong' | 'expired' | 'none' | 'locked' };

interface Waiting {
  tabId: string;
  origin: string;
  connection: Connection;
  /** Empty until the page offers its code. */
  code: string;
  expiresAt: number;
  requestCode(): void;
  onPaired(token: string): void;
}

/**
 * Every waiting tab generates its own code, shows it and offers it to the bridge. The user reads it to their AI
 * and the AI sends it with `pair_tab`. On a match the tab gets a token valid only for its origin, which the AI
 * can revoke later with `unpair_tab`.
 */
export class Pairing {
  private readonly tokens: Tokens;
  private readonly waiting = new Map<string, Waiting>();
  private failures = 0;
  private lockedUntil = 0;
  private nextLockMs = LOCK_FIRST_MS;
  /** Who holds each token: the live sessions it authorised, told when it is revoked. */
  private readonly holders = new Map<string, Set<() => void>>();

  constructor(
    private readonly store: TokenStore,
    private readonly onRequest: (origin: string) => void = () => {},
  ) {
    this.tokens = store.load();
  }

  findToken(origin: string, tokenId: string): string | undefined {
    return this.tokens[origin]?.find((token) => tokenIdOf(token) === tokenId);
  }

  isValid(origin: string, token: string): boolean {
    return this.tokens[origin]?.includes(token) ?? false;
  }

  /** The tab starts waiting and is asked for a code. A reloaded tab replaces its previous entry. */
  wait(tabId: string, origin: string, connection: Connection, callbacks: Pick<Waiting, 'requestCode' | 'onPaired'>): void {
    const waiting: Waiting = { tabId, origin, connection, code: '', expiresAt: 0, ...callbacks };
    this.waiting.set(tabId, waiting);
    waiting.requestCode();
    this.onRequest(origin);
  }

  /** Stores the code the page generated. If another tab already shows the same code, asks for a new one. */
  offer(tabId: string, code: string): void {
    const waiting = this.waiting.get(tabId);
    if (!waiting) return;
    const taken = [...this.waiting.values()].some((other) => other !== waiting && other.code === code);
    if (taken) {
      waiting.code = '';
      waiting.requestCode();
      return;
    }
    waiting.code = code;
    waiting.expiresAt = Date.now() + CODE_TTL_MS;
  }

  /** Removes the entry only if it still belongs to that connection; a reload may have replaced it already. */
  cancel(tabId: string, connection: Connection): void {
    if (this.waiting.get(tabId)?.connection === connection) this.waiting.delete(tabId);
  }

  /** Pairs the tab whose offered code matches the one the AI heard from the user. */
  pair(code: string): PairResult {
    if (Date.now() < this.lockedUntil) return { ok: false, reason: 'locked' };
    if (this.waiting.size === 0) return { ok: false, reason: 'none' };
    const match = [...this.waiting.values()].find((waiting) => waiting.code !== '' && waiting.code === code);

    if (match && match.expiresAt > Date.now()) {
      this.waiting.delete(match.tabId);
      this.failures = 0;
      this.nextLockMs = LOCK_FIRST_MS;
      const token = randomBytes(32).toString('hex');
      this.tokens[match.origin] = [...(this.tokens[match.origin] ?? []), token];
      this.store.save(this.tokens);
      match.onPaired(token);
      return { ok: true, tabId: match.tabId };
    }
    if (match) {
      this.renew(match);
      return { ok: false, reason: 'expired' };
    }

    this.failures += 1;
    if (this.failures >= MAX_FAILURES) {
      this.failures = 0;
      this.lockedUntil = Date.now() + this.nextLockMs;
      this.nextLockMs = Math.min(this.nextLockMs * 2, LOCK_MAX_MS);
      for (const waiting of this.waiting.values()) this.renew(waiting);
    }
    return { ok: false, reason: 'wrong' };
  }

  /** Registers a live session authorised by a token, to be told when it is revoked. Returns a function that releases it. */
  hold(origin: string, token: string, onRevoked: () => void): () => void {
    const key = `${origin} ${token}`;
    const set = this.holders.get(key) ?? new Set();
    set.add(onRevoked);
    this.holders.set(key, set);
    return () => void set.delete(onRevoked);
  }

  /** Revokes a token and tells every live session it authorised, so all of them go back to pairing. */
  revoke(origin: string, token: string): void {
    const list = this.tokens[origin];
    if (!list?.includes(token)) return;
    this.tokens[origin] = list.filter((t) => t !== token);
    this.store.save(this.tokens);
    const key = `${origin} ${token}`;
    const set = this.holders.get(key);
    this.holders.delete(key);
    for (const onRevoked of set ?? []) onRevoked();
  }

  private renew(waiting: Waiting): void {
    waiting.code = '';
    waiting.requestCode();
  }
}

export const tokenIdOf = (token: string): string => createHash('sha256').update(token).digest('hex').slice(0, 16);

export const proofOf = (token: string, message: string): string => createHmac('sha256', token).update(message).digest('hex');

export const sameProof = (a: string, b: string): boolean =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const newNonce = (): string => randomBytes(16).toString('hex');
