import { type BridgeMessage, type Order, PROTOCOL_VERSION } from '@reins-ai/contract';

import { createBridgeCore, type Connection, type Tokens, type TokenStore } from '../src/core/index.js';
import { proofOf, tokenIdOf } from '../src/core/pairing.js';

export const ORIGIN = 'http://localhost:4200';

/** A fake connection that records everything the core sends to it. */
export class FakeConnection implements Connection {
  readonly sent: BridgeMessage[] = [];
  closed = false;

  constructor(readonly origin = ORIGIN) {}

  send(message: BridgeMessage): void {
    this.sent.push(message);
  }

  close(): void {
    this.closed = true;
  }

  last(): BridgeMessage | undefined {
    return this.sent.at(-1);
  }

  /** The last message, if it is a session message (welcome, pair_required…) rather than an order. */
  lastSession(): Exclude<BridgeMessage, Order> | undefined {
    const message = this.last();
    return message && 'type' in message ? message : undefined;
  }
}

export class MemoryTokenStore implements TokenStore {
  constructor(public tokens: Tokens = {}) {}

  load(): Tokens {
    return structuredClone(this.tokens);
  }

  save(tokens: Tokens): void {
    this.tokens = structuredClone(tokens);
  }
}

/** A test core that records which origins asked to pair. */
export function testCore(store = new MemoryTokenStore()) {
  const requests: string[] = [];
  const core = createBridgeCore({ tokenStore: store, onPairingRequest: (origin) => requests.push(origin) });
  return { core, requests, store };
}

/** The page generates its code and offers it to the bridge, as agent-web does on pair_required. */
export const offer = (code: string) => JSON.stringify({ type: 'pair_offer', code });

/** A distinct code per tab. */
export const codeFor = (tabId: string) => String(100_000 + (([...tabId].reduce((n, c) => n * 31 + c.charCodeAt(0), 7) >>> 0) % 900_000));

export const json = (value: unknown) => JSON.stringify(value);

export const NONCE = '0123456789abcdef0123456789abcdef';

export const hello = (tabId: string, token?: string) =>
  json({ type: 'hello', protocolVersion: PROTOCOL_VERSION, tabId, nonce: NONCE, ...(token ? { tokenId: tokenIdOf(token) } : {}) });

export function resume(session: { receive(raw: string): void }, connection: FakeConnection, tabId: string, token: string) {
  session.receive(hello(tabId, token));
  const challenge = connection.lastSession();
  if (challenge?.type === 'challenge') session.receive(json({ type: 'proof', proof: proofOf(token, `page:${challenge.nonce}`) }));
}

/** Connects and pairs a tab the way the AI would with the on-screen code; returns its connection, session and token. */
export function pairTab(t: ReturnType<typeof testCore>, tabId = 't1', connection = new FakeConnection()) {
  const session = t.core.connect(connection);
  session.receive(hello(tabId));
  session.receive(offer(codeFor(tabId)));
  t.core.pairWithCode(codeFor(tabId));
  const welcome = connection.lastSession();
  if (welcome?.type !== 'welcome') throw new Error('Not paired');
  return { connection, session, token: welcome.token };
}
