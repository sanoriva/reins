import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PROTOCOL_VERSION } from '@reins-ai/contract';

import { proofOf } from '../../src/core/pairing.js';
import { FakeConnection, hello, json, MemoryTokenStore, NONCE, offer, ORIGIN, pairTab, resume, testCore } from '../connection.fake.js';

describe('session: handshake', () => {
  it('answers session_error and closes when the first message is not hello', () => {
    const { core } = testCore();
    const connection = new FakeConnection();
    core.connect(connection).receive(json({ event: 'tab.state', data: { state: 'active' } }));
    assert.equal(connection.lastSession()?.type, 'session_error');
    assert.equal(connection.closed, true);
  });

  it('answers session_error and closes on broken JSON', () => {
    const { core } = testCore();
    const connection = new FakeConnection();
    core.connect(connection).receive('{broken');
    const last = connection.lastSession();
    assert.equal(last?.type === 'session_error' && last.code, 'INVALID_MESSAGE');
    assert.equal(connection.closed, true);
  });

  it('answers VERSION_MISMATCH and closes on another protocol version', () => {
    const { core } = testCore();
    const connection = new FakeConnection();
    core.connect(connection).receive(json({ type: 'hello', protocolVersion: PROTOCOL_VERSION + 1, tabId: 't1', nonce: NONCE }));
    const last = connection.lastSession();
    assert.equal(last?.type === 'session_error' && last.code, 'VERSION_MISMATCH');
    assert.equal(connection.closed, true);
  });

  /** The page generates its code and shows it. */
  it('without a token: pair_required; the page offers its code and gets welcome once the AI sends it', () => {
    const t = testCore();
    const connection = new FakeConnection();
    const session = t.core.connect(connection);
    session.receive(hello('t1'));
    assert.deepEqual(connection.lastSession(), { type: 'pair_required' });
    assert.deepEqual(t.requests, [ORIGIN]);
    session.receive(offer('482913'));
    assert.deepEqual(t.core.pairWithCode('482913'), { ok: true, tabId: 't1' });
    assert.equal(connection.lastSession()?.type, 'welcome');
    assert.equal(t.core.tabs()[0]?.tabId, 't1');
  });

  it('a valid token connects directly, without a code, after the challenge and the proof', () => {
    const t = testCore();
    const { token } = pairTab(t);
    const connection = new FakeConnection();
    const session = t.core.connect(connection);
    session.receive(hello('t2', token));
    const challenge = connection.lastSession();
    assert.equal(challenge?.type, 'challenge');
    if (challenge?.type !== 'challenge') return;
    assert.equal(challenge.proof, proofOf(token!, `bridge:${NONCE}`));
    session.receive(json({ type: 'proof', proof: proofOf(token!, `page:${challenge.nonce}`) }));
    assert.deepEqual(connection.last(), { type: 'welcome', protocolVersion: PROTOCOL_VERSION });
    assert.equal(t.requests.length, 1);
  });

  it('a wrong proof starts pairing', () => {
    const t = testCore();
    const { token } = pairTab(t);
    const connection = new FakeConnection();
    const session = t.core.connect(connection);
    session.receive(hello('t2', token));
    session.receive(json({ type: 'proof', proof: '0'.repeat(64) }));
    assert.deepEqual(connection.lastSession(), { type: 'pair_required' });
  });

  it('a token from another origin is not valid', () => {
    const store = new MemoryTokenStore({ 'https://other-site.com': ['abc'] });
    const t = testCore(store);
    const connection = new FakeConnection(ORIGIN);
    t.core.connect(connection).receive(hello('t1', 'abc'));
    assert.equal(connection.lastSession()?.type, 'pair_required');
  });

  it('only accepts pair_offer while pairing; anything else answers session_error and closes', () => {
    const t = testCore();
    const connection = new FakeConnection();
    const session = t.core.connect(connection);
    session.receive(hello('t1'));
    session.receive(json({ event: 'tab.state', data: { state: 'active' } }));
    assert.equal(connection.lastSession()?.type, 'session_error');
    assert.equal(connection.closed, true);
  });

  it('its code stops working when it closes while pairing', () => {
    const t = testCore();
    const connection = new FakeConnection();
    const session = t.core.connect(connection);
    session.receive(hello('t1'));
    session.receive(offer('482913'));
    session.disconnected();
    assert.deepEqual(t.core.pairWithCode('482913'), { ok: false, reason: 'none' });
  });
});

describe('session: the AI disconnects', () => {
  /** The page generates a new code and pairs again with it. The old token is no longer valid on reload. */
  it('unpair sends unpaired and pair_required, removes the tab and revokes the token', async () => {
    const t = testCore();
    const { connection, session, token } = pairTab(t);
    const pending = t.core.sendOrder('t1', 'get_state');
    assert.equal(t.core.unpairTab('t1'), true);
    assert.deepEqual(connection.sent.slice(-2), [{ type: 'unpaired' }, { type: 'pair_required' }]);
    assert.deepEqual(t.core.tabs(), []);
    const response = await pending;
    assert.equal(!response.ok && response.error.code, 'TAB_DISCONNECTED');
    assert.deepEqual(t.store.tokens, { [ORIGIN]: [] });
    session.receive(offer('105377'));
    assert.equal(t.core.pairWithCode('105377').ok, true);
    assert.equal(t.core.tabs().length, 1);
    const reloaded = new FakeConnection();
    resume(t.core.connect(reloaded), reloaded, 't2', token!);
    assert.deepEqual(reloaded.lastSession(), { type: 'pair_required' });
  });

  /** Every tab of an origin shares its token, so revoking it disconnects all of them. */
  it('unpair disconnects every other live tab that connected with the same token', () => {
    const t = testCore();
    const { token } = pairTab(t);
    const other = new FakeConnection();
    resume(t.core.connect(other), other, 't2', token!);
    assert.equal(other.lastSession()?.type, 'welcome');
    assert.equal(t.core.unpairTab('t1'), true);
    assert.deepEqual(other.sent.slice(-2), [{ type: 'unpaired' }, { type: 'pair_required' }]);
    assert.deepEqual(t.core.tabs(), []);
  });

  it('unpair of a tab that is not connected returns false', () => {
    const { core } = testCore();
    assert.equal(core.unpairTab('t9'), false);
  });
});

describe('session: ready', () => {
  it('page.changed updates the tab and goes to the event queue', () => {
    const t = testCore();
    const { session } = pairTab(t);
    const event = { event: 'page.changed', data: { route: '/recipes', title: 'Recipes', page: 2, actions: [] } };
    session.receive(json(event));
    assert.equal(t.core.tabs()[0]?.page, 2);
    assert.deepEqual(t.core.drainEvents(), [{ tabId: 't1', event }]);
  });

  it('an order carries the screen counter and gets its response', async () => {
    const t = testCore();
    const { session, connection } = pairTab(t);
    session.receive(json({ event: 'page.changed', data: { route: '/', title: 'Home', page: 2, actions: [] } }));
    const pending = t.core.sendOrder('t1', 'get_state');
    const order = connection.last();
    assert.equal(order && 'action' in order && order.page, 2);
    session.receive(json({ id: order && 'id' in order ? order.id : '', ok: true, result: { route: '/' } }));
    assert.deepEqual((await pending).ok, true);
  });

  it('on disconnection: running orders get TAB_DISCONNECTED, the tab leaves and tab.state closed is queued', async () => {
    const t = testCore();
    const { session } = pairTab(t);
    const pending = t.core.sendOrder('t1', 'get_state');
    session.disconnected();
    const response = await pending;
    assert.equal(!response.ok && response.error.code, 'TAB_DISCONNECTED');
    assert.deepEqual(t.core.tabs(), []);
    assert.deepEqual(t.core.drainEvents(), [{ tabId: 't1', event: { event: 'tab.state', data: { state: 'closed' } } }]);
  });

  it('when the tab reloads, the old connection does not remove it when it drops', () => {
    const t = testCore();
    const first = pairTab(t, 't1');
    const reloaded = new FakeConnection();
    resume(t.core.connect(reloaded), reloaded, 't1', first.token!);
    first.session.disconnected();
    assert.equal(t.core.tabs().length, 1);
    assert.deepEqual(t.core.drainEvents(), []);
  });

  it('answers session_error and closes on a session message once ready', () => {
    const t = testCore();
    const { session, connection } = pairTab(t);
    session.receive(hello('t1'));
    assert.equal(connection.lastSession()?.type, 'session_error');
    assert.equal(connection.closed, true);
  });

  it('ignores anything that arrives after closing', () => {
    const { core } = testCore();
    const connection = new FakeConnection();
    const session = core.connect(connection);
    session.receive('{broken');
    const count = connection.sent.length;
    session.receive(hello('t1'));
    assert.equal(connection.sent.length, count);
  });
});
