import type { AgentAction, AgentOptions, ChannelState, WebSocketLike } from '../src/index.js';
import { createAgent } from '../src/index.js';

/** A fake WebSocket: records what the page sends and lets the test play the bridge. */
export class FakeSocket implements WebSocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: Record<string, unknown>[] = [];
  closed = false;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }

  /** Bridge side. */
  open(): void {
    this.onopen?.();
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  pair(): void {
    this.receive({ type: 'pair_required' });
    this.receive(welcome);
  }

  last(): Record<string, unknown> | undefined {
    return this.sent.at(-1);
  }
}

export class MemoryStorage {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

export const welcome = { type: 'welcome', protocolVersion: 2, token: 'tok' };

/** Waits for pending promises, such as an order in the pipeline. */
export const flush = () => new Promise((resolve) => setImmediate(resolve));

export function testAgent(actions: AgentAction[] = [], storage = { local: new MemoryStorage(), session: new MemoryStorage() }, extra: Partial<AgentOptions> = {}) {
  const sockets: FakeSocket[] = [];
  const agent = createAgent({
    ...extra,
    actions,
    storage,
    createSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
  });
  const states: ChannelState[] = [];
  agent.onState((state) => states.push(state));
  return { agent, sockets, storage, states, socket: () => sockets.at(-1)! };
}

/** An agent that is connected and has its session ready. */
export function readyAgent(actions: AgentAction[] = [], extra: Partial<AgentOptions> = {}) {
  const t = testAgent(actions, undefined, extra);
  t.agent.start();
  t.socket().open();
  t.socket().pair();
  return t;
}
