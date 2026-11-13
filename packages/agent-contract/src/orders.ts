import { z } from 'zod';

/** Screen counter. It increases with every `page.changed`. */
export const PageCounter = z.int().nonnegative();

/**
 * An order from the AI to the page. `page` is the screen counter the AI knew when it sent the order: if the
 * screen has changed since, the page answers `PAGE_CHANGED` instead of acting on a screen the AI has not seen.
 *
 * @example
 * const order: Order = { id: 'o-1', action: 'highlight', params: { text: 'Fasting glucose' }, page: 4 };
 */
export const Order = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
  page: PageCounter,
});
export type Order = z.infer<typeof Order>;

/** Error codes defined by the protocol. Actions may add their own, in UPPER_SNAKE_CASE (e.g. `TEXT_NOT_FOUND`). */
export const ProtocolErrorCode = {
  UNKNOWN_ACTION: 'UNKNOWN_ACTION',
  INVALID_PARAMS: 'INVALID_PARAMS',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION',
  INVALID_CODE: 'INVALID_CODE',
  TIMEOUT: 'TIMEOUT',
  PAGE_CHANGED: 'PAGE_CHANGED',
  TAB_DISCONNECTED: 'TAB_DISCONNECTED',
} as const;

export const OrderError = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  message: z.string().min(1),
  attemptsLeft: z.int().nonnegative().optional(),
});
export type OrderError = z.infer<typeof OrderError>;

export const OrderSuccess = z.object({
  id: z.string().min(1),
  ok: z.literal(true),
  result: z.unknown(),
});

export const OrderFailure = z.object({
  id: z.string().min(1),
  ok: z.literal(false),
  error: OrderError,
});

/**
 * The page's answer to an order: exactly one per order, with the same id.
 *
 * @example
 * const done: OrderResponse = { id: 'o-1', ok: true, result: { scrolled: false } };
 * const failed: OrderResponse = { id: 'o-2', ok: false, error: { code: 'TEXT_NOT_FOUND', message: 'That text is not on the screen' } };
 */
export const OrderResponse = z.discriminatedUnion('ok', [OrderSuccess, OrderFailure]);
export type OrderResponse = z.infer<typeof OrderResponse>;
