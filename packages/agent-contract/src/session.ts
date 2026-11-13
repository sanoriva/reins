import { z } from 'zod';

/** Protocol version. Bumped only for incompatible changes; the bridge rejects pages on another version. */
export const PROTOCOL_VERSION = 2;

export const PairingCode = z.string().regex(/^\d{6}$/);

/**
 * First message from the page on every connection. `tabId` identifies the tab across reloads; `token` comes from
 * a previous pairing and skips pairing again.
 *
 * @example
 * const hello: Hello = { type: 'hello', protocolVersion: PROTOCOL_VERSION, tabId: crypto.randomUUID() };
 */
export const Hello = z.object({
  type: z.literal('hello'),
  protocolVersion: z.int().positive(),
  tabId: z.string().min(1),
  /** 16 random bytes in hex: the bridge proves it knows the token by signing it. */
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  /** First 16 hex characters of SHA-256(token), so the bridge finds the token without it ever being sent. */
  tokenId: z.string().regex(/^[0-9a-f]{16}$/).optional(),
});
export type Hello = z.infer<typeof Hello>;

/**
 * The 6-digit code the page generated and shows on screen. The user reads it to their AI, the AI sends it to the
 * bridge with `pair_tab`, and the bridge pairs the tab whose offer matches.
 */
export const PairOffer = z.object({
  type: z.literal('pair_offer'),
  code: PairingCode,
});
export type PairOffer = z.infer<typeof PairOffer>;

/** The session is ready. The page keeps `token` to skip pairing next time. */
export const Welcome = z.object({
  type: z.literal('welcome'),
  protocolVersion: z.int().positive(),
  /** Only after pairing; a tab that proved its token keeps the one it has. */
  token: z.string().min(1).optional(),
});
export type Welcome = z.infer<typeof Welcome>;

/**
 * The tab must be paired: the page generates a code, shows it and sends it with `pair_offer`. Sent again when
 * the code expires or after 5 failed attempts.
 */
export const PairRequired = z.object({
  type: z.literal('pair_required'),
});
export type PairRequired = z.infer<typeof PairRequired>;

/** The AI disconnected this tab: its token is revoked and `pair_required` follows. */
export const Unpaired = z.object({
  type: z.literal('unpaired'),
});
export type Unpaired = z.infer<typeof Unpaired>;

/** A session error. The bridge closes the connection right after sending it. */
export const SessionError = z.object({
  type: z.literal('session_error'),
  code: z.enum(['VERSION_MISMATCH', 'INVALID_MESSAGE']),
  message: z.string().min(1),
});
export type SessionError = z.infer<typeof SessionError>;

const Hex64 = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * The bridge proves it knows the token the tab offered by tokenId: proof = hex(HMAC-SHA256(token, "bridge:" + the
 * page nonce)). It sends its own nonce for the page to prove the same in return. A process that took the port without
 * the token cannot answer it, and the token never travels.
 */
export const Challenge = z.object({
  type: z.literal('challenge'),
  proof: Hex64,
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
});
export type Challenge = z.infer<typeof Challenge>;

/** The page answers the challenge: proof = hex(HMAC-SHA256(token, "page:" + the bridge nonce)). */
export const Proof = z.object({
  type: z.literal('proof'),
  proof: Hex64,
});
export type Proof = z.infer<typeof Proof>;
