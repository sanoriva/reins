import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { PROTOCOL_VERSION } from '@reins-ai/contract';

import { proofOf, tokenIdOf } from '../../src/channel.js';
import { DEFAULT_BRIDGE_URL } from '../../src/index.js';
import { MemoryStorage, readyAgent, testAgent, welcome } from '../socket.fake.js';

/** Waits until `check` holds: Web Crypto answers outside the microtask queue. */
async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 5));
}

describe('channel: handshake', () => {
  it('connects to the default bridge and sends hello with its tabId', () => {
    const t = testAgent();
    t.agent.start();
    assert.equal(t.socket().url, DEFAULT_BRIDGE_URL);
    t.socket().open();
    const hello = t.socket().last();
    assert.equal(hello?.type, 'hello');
    assert.equal(hello?.protocolVersion, PROTOCOL_VERSION);
    assert.equal(typeof hello?.tabId, 'string');
    assert.match(String(hello?.nonce), /^[0-9a-f]{32}$/);
    assert.equal('tokenId' in (hello ?? {}), false);
  });

  it('the tabId survives a reload (sessionStorage)', () => {
    const storage = { local: new MemoryStorage(), session: new MemoryStorage() };
    const first = testAgent([], storage);
    const second = testAgent([], storage);
    first.agent.start();
    second.agent.start();
    first.socket().open();
    second.socket().open();
    assert.equal(first.socket().last()?.tabId, second.socket().last()?.tabId);
  });

  it('pairing: generates a code, exposes it in the state and offers it to the bridge; generates a new one when asked again', () => {
    const t = testAgent();
    t.agent.start();
    t.socket().open();
    t.socket().receive({ type: 'pair_required' });
    const state = t.agent.state;
    assert.equal(state.status, 'pairing');
    const code = state.status === 'pairing' ? state.code : '';
    assert.match(code, /^\d{6}$/);
    assert.deepEqual(t.socket().last(), { type: 'pair_offer', code });
    t.socket().receive({ type: 'pair_required' });
    assert.equal(t.socket().sent.filter((m) => m.type === 'pair_offer').length, 2);
    t.socket().pair();
    assert.deepEqual(t.agent.state, { status: 'ready' });
    assert.equal(t.storage.local.getItem('sanoriva-agent.token'), 'tok');
  });

  it('with a stored token, hello sends its id and not the token', async () => {
    const t = testAgent();
    t.storage.local.setItem('sanoriva-agent.token', 'tok');
    t.agent.start();
    t.socket().open();
    await until(() => t.socket().last()?.type === 'hello');
    assert.equal(t.socket().last()?.tokenId, await tokenIdOf('tok'));
    assert.equal('token' in (t.socket().last() ?? {}), false);
  });

  it('answers a valid challenge with its proof and keeps its token on welcome', async () => {
    const t = testAgent();
    t.storage.local.setItem('sanoriva-agent.token', 'tok');
    t.agent.start();
    t.socket().open();
    await until(() => t.socket().last()?.type === 'hello');
    const nonce = String(t.socket().last()?.nonce);
    const bridgeNonce = 'f'.repeat(32);
    t.socket().receive({ type: 'challenge', proof: await proofOf('tok', `bridge:${nonce}`), nonce: bridgeNonce });
    await until(() => t.socket().last()?.type === 'proof');
    assert.deepEqual(t.socket().last(), { type: 'proof', proof: await proofOf('tok', `page:${bridgeNonce}`) });
    t.socket().receive({ type: 'welcome', protocolVersion: PROTOCOL_VERSION });
    assert.deepEqual(t.agent.state, { status: 'ready' });
    assert.equal(t.storage.local.getItem('sanoriva-agent.token'), 'tok');
  });

  it('a wrong bridge proof ends in error, without sending a proof', async () => {
    const t = testAgent();
    t.storage.local.setItem('sanoriva-agent.token', 'tok');
    t.agent.start();
    t.socket().open();
    await until(() => t.socket().last()?.type === 'hello');
    t.socket().receive({ type: 'challenge', proof: '0'.repeat(64), nonce: 'f'.repeat(32) });
    await until(() => t.agent.state.status === 'error');
    assert.equal(t.agent.state.status, 'error');
    assert.equal(t.socket().sent.some((m) => m.type === 'proof'), false);
  });

  it('ignores a welcome that comes without pairing or proof', () => {
    const t = testAgent();
    t.agent.start();
    t.socket().open();
    t.socket().receive(welcome);
    assert.equal(t.agent.state.status, 'connecting');
  });

  it('sends nothing while pairing', () => {
    const t = testAgent();
    t.agent.start();
    t.socket().open();
    t.socket().receive({ type: 'pair_required' });
    const count = t.socket().sent.length;
    t.agent.setPage({ route: '/', title: 'Home' });
    assert.equal(t.socket().sent.length, count);
  });

  it('reports every state, starting with the current one', () => {
    const t = testAgent();
    t.agent.start();
    t.socket().open();
    t.socket().pair();
    assert.deepEqual(
      t.states.map((s) => s.status),
      ['connecting', 'connecting', 'pairing', 'ready'],
    );
  });
});

describe('channel: the AI disconnects', () => {
  it('unpaired clears the token and the next pair_required generates a new code', () => {
    const t = readyAgent();
    assert.equal(t.storage.local.getItem('sanoriva-agent.token'), 'tok');
    t.socket().receive({ type: 'unpaired' });
    assert.equal(t.storage.local.getItem('sanoriva-agent.token'), null);
    t.socket().receive({ type: 'pair_required' });
    assert.equal(t.agent.state.status, 'pairing');
    assert.equal(t.socket().last()?.type, 'pair_offer');
  });
});

describe('channel: reconnection', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  it('retries with increasing delays up to 10 s', () => {
    const t = testAgent();
    t.agent.start();
    const waits: number[] = [];
    for (let i = 0; i < 7; i++) {
      t.socket().close();
      const state = t.agent.state;
      assert.equal(state.status, 'waiting');
      if (state.status === 'waiting') {
        waits.push(state.retryInMs);
        mock.timers.tick(state.retryInMs);
      }
    }
    assert.deepEqual(waits, [500, 1000, 2000, 4000, 8000, 10_000, 10_000]);
    assert.equal(t.sockets.length, 8);
  });

  it('after a successful connection, the delay goes back to 0.5 s', () => {
    const t = testAgent();
    t.agent.start();
    t.socket().close();
    mock.timers.tick(500);
    t.socket().close();
    mock.timers.tick(1000);
    t.socket().open();
    t.socket().pair();
    t.socket().close();
    assert.deepEqual(t.agent.state, { status: 'waiting', retryInMs: 500 });
  });

  it('does not retry after session_error', () => {
    const t = testAgent();
    t.agent.start();
    t.socket().open();
    t.socket().receive({ type: 'session_error', code: 'VERSION_MISMATCH', message: 'Version 1 not supported' });
    assert.deepEqual(t.agent.state, { status: 'error', message: 'Version 1 not supported' });
    mock.timers.tick(10_000);
    assert.equal(t.sockets.length, 1);
  });

  it('stop() closes and does not retry', () => {
    const t = readyAgent();
    t.agent.stop();
    mock.timers.tick(10_000);
    assert.equal(t.sockets.length, 1);
  });
});
