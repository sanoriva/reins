import { EventQueue } from './events.js';
import { Pairing } from './pairing.js';
import type { Connection, TokenStore } from './ports.js';
import { Router } from './router.js';
import { createSession } from './session.js';
import { Tabs } from './tabs.js';

export { MAX_QUEUED_EVENTS, type QueuedEvent } from './events.js';
export type { PairResult } from './pairing.js';
export type { Connection, Tokens, TokenStore } from './ports.js';
export type { Session } from './session.js';
export type { TabInfo } from './tabs.js';

export interface BridgeCoreOptions {
  tokenStore: TokenStore;
  /** Called when a tab from `origin` starts pairing and shows its code. */
  onPairingRequest?(origin: string): void;
}

/**
 * All the bridge logic, with no networking. The adapters only see this: the WebSocket adapter opens one session
 * per tab connection and the MCP adapter pairs tabs and sends them orders.
 */
export function createBridgeCore({ tokenStore, onPairingRequest }: BridgeCoreOptions) {
  const pairing = new Pairing(tokenStore, onPairingRequest);
  const tabs = new Tabs();
  const router = new Router(tabs);
  const events = new EventQueue();

  return {
    connect: (connection: Connection) => createSession(connection, { pairing, tabs, router, events }),
    pairWithCode: (code: string) => pairing.pair(code),
    /** Disconnects a tab at the AI's request. Returns `false` if it was not connected. */
    unpairTab: (tabId: string) => {
      const tab = tabs.get(tabId);
      tab?.unpair();
      return tab !== undefined;
    },
    tabs: () => tabs.list(),
    sendOrder: (tabId: string, action: string, params?: Record<string, unknown>, page?: number) => router.send(tabId, action, params, page),
    drainEvents: () => events.drain(),
    onEvent: (listener: Parameters<EventQueue['onEvent']>[0]) => events.onEvent(listener),
  };
}

export type BridgeCore = ReturnType<typeof createBridgeCore>;
