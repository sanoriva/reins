import { z } from 'zod';

import { PageEvent } from './events.js';
import { Order, OrderResponse } from './orders.js';
import { Challenge, Hello, PairOffer, PairRequired, Proof, SessionError, Unpaired, Welcome } from './session.js';

/** Everything the page can send to the bridge. */
export const PageMessage = z.union([Hello, PairOffer, Proof, OrderResponse, PageEvent]);
export type PageMessage = z.infer<typeof PageMessage>;

/** Everything the bridge can send to the page. */
export const BridgeMessage = z.union([Welcome, Challenge, PairRequired, Unpaired, SessionError, Order]);
export type BridgeMessage = z.infer<typeof BridgeMessage>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parse<T>(schema: z.ZodType<T>, raw: string): ParseResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Not valid JSON' };
  }
  const result = schema.safeParse(json);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: z.prettifyError(result.error) };
}

/**
 * Parses and validates a raw message received by the bridge.
 *
 * @example
 * const parsed = parsePageMessage(raw);
 * if (!parsed.ok) socket.close(1008, parsed.error);
 */
export const parsePageMessage = (raw: string): ParseResult<PageMessage> => parse(PageMessage, raw);

/** Parses and validates a raw message received by the page. */
export const parseBridgeMessage = (raw: string): ParseResult<BridgeMessage> =>
  parse(BridgeMessage, raw);

