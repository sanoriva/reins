import { type Order, type OrderResponse, ProtocolErrorCode } from '@reins-ai/contract';
import { z } from 'zod';

import { type ActionContext, ActionError, type AgentAction } from './action.js';

/** Runs an order: screen counter → action → parameters → run. Always produces exactly one response. */
export async function dispatch(
  order: Order,
  actions: ReadonlyMap<string, AgentAction>,
  context: ActionContext,
): Promise<OrderResponse> {
  const fail = (code: string, message: string, attemptsLeft?: number): OrderResponse => ({
    id: order.id,
    ok: false,
    error: { code, message, ...(attemptsLeft === undefined ? {} : { attemptsLeft }) },
  });

  if (order.page !== context.page) {
    return fail(ProtocolErrorCode.PAGE_CHANGED, 'The screen changed since your order; ask the user whether to continue on the new one');
  }

  const action = actions.get(order.action);
  if (!action) return fail(ProtocolErrorCode.UNKNOWN_ACTION, `Action ${order.action} does not exist on this page`);

  const params = action.params.safeParse(order.params);
  if (!params.success) return fail(ProtocolErrorCode.INVALID_PARAMS, z.prettifyError(params.error));

  try {
    const result = await action.run(params.data, context);
    return { id: order.id, ok: true, result: result ?? null };
  } catch (error) {
    if (error instanceof ActionError) return fail(error.code, error.message, error.attemptsLeft);
    return fail(ProtocolErrorCode.NOT_AVAILABLE, error instanceof Error ? error.message : 'The action failed');
  }
}
