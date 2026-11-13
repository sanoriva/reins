import { type PageMessage, parsePageMessage, PROTOCOL_VERSION } from '@reins-ai/contract';

import type { EventQueue } from './events.js';
import { newNonce, type Pairing, proofOf, sameProof } from './pairing.js';
import type { Connection } from './ports.js';
import type { Router } from './router.js';
import type { Tabs } from './tabs.js';

export interface SessionDeps {
  pairing: Pairing;
  tabs: Tabs;
  router: Router;
  events: EventQueue;
}

/** What the adapter does with a connection: pass on what arrives and report when it drops. */
export interface Session {
  receive(raw: string): void;
  disconnected(): void;
}

type State = 'hello' | 'proving' | 'pairing' | 'ready' | 'closed';

const isType = <T extends string>(msg: PageMessage, type: T): msg is Extract<PageMessage, { type: T }> =>
  'type' in msg && msg.type === type;

/**
 * One tab connection from start to end: hello → (the page offers its code until the AI sends it) → welcome, then
 * responses and events. When the AI disconnects the tab, it goes back to pairing.
 */
export function createSession(connection: Connection, { pairing, tabs, router, events }: SessionDeps): Session {
  let state: State = 'hello';
  let tabId = '';
  let token = '';
  let release = () => {};
  let claimed = '';
  let nonce = '';

  const fail = (code: 'VERSION_MISMATCH' | 'INVALID_MESSAGE', message: string) => {
    state = 'closed';
    connection.send({ type: 'session_error', code, message });
    connection.close();
  };

  /** A tab that proved its token already has it: only a new pairing hands one over. */
  const ready = (granted: string, handOver = true) => {
    if (state === 'closed') return;
    state = 'ready';
    token = granted;
    release = pairing.hold(connection.origin, token, () => unpair());
    tabs.add(tabId, connection, unpair);
    connection.send({ type: 'welcome', protocolVersion: PROTOCOL_VERSION, ...(handOver ? { token } : {}) });
  };

  const startPairing = () => {
    state = 'pairing';
    pairing.wait(tabId, connection.origin, connection, {
      requestCode: () => connection.send({ type: 'pair_required' }),
      onPaired: ready,
    });
  };

  /** The AI disconnects the tab: its token is revoked, it leaves the list and asks for a code again. */
  const unpair = () => {
    if (state !== 'ready') return;
    release();
    pairing.revoke(connection.origin, token);
    router.connectionGone(connection);
    if (tabs.remove(tabId, connection)) events.push(tabId, { event: 'tab.state', data: { state: 'closed' } });
    connection.send({ type: 'unpaired' });
    startPairing();
  };

  const onHello = (msg: PageMessage) => {
    if (!isType(msg, 'hello')) return fail('INVALID_MESSAGE', 'The first message must be hello');
    if (msg.protocolVersion !== PROTOCOL_VERSION) {
      return fail('VERSION_MISMATCH', `Version ${msg.protocolVersion} is not supported; this bridge uses version ${PROTOCOL_VERSION}`);
    }
    tabId = msg.tabId;
    const found = msg.tokenId ? pairing.findToken(connection.origin, msg.tokenId) : undefined;
    if (!found) return startPairing();
    state = 'proving';
    claimed = found;
    nonce = newNonce();
    connection.send({ type: 'challenge', proof: proofOf(found, `bridge:${msg.nonce}`), nonce });
  };

  const onProving = (msg: PageMessage) => {
    if (!isType(msg, 'proof')) return fail('INVALID_MESSAGE', 'The page must answer the challenge with its proof');
    if (sameProof(msg.proof, proofOf(claimed, `page:${nonce}`))) return ready(claimed, false);
    startPairing();
  };

  /** While pairing, the tab may only offer its code. */
  const onPairing = (msg: PageMessage) => {
    if (!isType(msg, 'pair_offer')) return fail('INVALID_MESSAGE', 'Not paired yet: the page must offer its code');
    pairing.offer(tabId, msg.code);
  };

  const onReady = (msg: PageMessage) => {
    if ('ok' in msg) {
      router.resolve(tabId, msg);
      return;
    }
    if ('event' in msg) {
      if (msg.event === 'page.changed') tabs.pageChanged(tabId, msg.data);
      if (msg.event === 'tab.state') tabs.tabState(tabId, msg.data.state);
      events.push(tabId, msg);
      return;
    }
    fail('INVALID_MESSAGE', 'Unexpected session message');
  };

  return {
    receive(raw) {
      if (state === 'closed') return;
      const parsed = parsePageMessage(raw);
      if (!parsed.ok) return fail('INVALID_MESSAGE', parsed.error);
      if (state === 'hello') return onHello(parsed.value);
      if (state === 'proving') return onProving(parsed.value);
      if (state === 'pairing') return onPairing(parsed.value);
      onReady(parsed.value);
    },

    disconnected() {
      const previous = state;
      state = 'closed';
      release();
      if (previous === 'pairing') pairing.cancel(tabId, connection);
      if (previous !== 'ready') return;
      router.connectionGone(connection);
      if (tabs.remove(tabId, connection)) {
        events.push(tabId, { event: 'tab.state', data: { state: 'closed' } });
      }
    },
  };
}
