import { type OrderResponse, ProtocolErrorCode } from '@reins-ai/contract';

import type { Connection } from './ports.js';
import type { Tabs } from './tabs.js';

export const ORDER_TIMEOUT_MS = 10_000;

interface Pending {
  tabId: string;
  connection: Connection;
  resolve: (response: OrderResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

const failure = (id: string, code: string, message: string): OrderResponse => ({
  id,
  ok: false,
  error: { code, message },
});

/** Sends orders to the tabs and waits for exactly one response per order. */
export class Router {
  private nextId = 1;
  private readonly pending = new Map<string, Pending>();

  constructor(private readonly tabs: Tabs) {}

  /** Sends an order stamped with `page`, the screen counter the sender has seen; without it, the latest one received. */
  send(tabId: string, action: string, params: Record<string, unknown> = {}, page?: number): Promise<OrderResponse> {
    const id = `o${this.nextId++}`;
    const tab = this.tabs.get(tabId);
    if (!tab) {
      return Promise.resolve(failure(id, ProtocolErrorCode.TAB_DISCONNECTED, 'The tab is not connected'));
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(failure(id, ProtocolErrorCode.TIMEOUT, 'The page did not answer in time'));
      }, ORDER_TIMEOUT_MS);
      this.pending.set(id, { tabId, connection: tab.connection, resolve, timer });
      tab.connection.send({ id, action, params, page: page ?? tab.info.page });
    });
  }

  /** Hands the response to whoever is waiting. Late, foreign or unknown responses are ignored. */
  resolve(tabId: string, response: OrderResponse): boolean {
    const pending = this.pending.get(response.id);
    if (!pending || pending.tabId !== tabId) return false;
    clearTimeout(pending.timer);
    this.pending.delete(response.id);
    pending.resolve(response);
    return true;
  }

  /** The connection dropped: its running orders fail with TAB_DISCONNECTED. */
  connectionGone(connection: Connection): void {
    for (const [id, pending] of this.pending) {
      if (pending.connection !== connection) continue;
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.resolve(failure(id, ProtocolErrorCode.TAB_DISCONNECTED, 'The tab was closed or reloaded'));
    }
  }
}
