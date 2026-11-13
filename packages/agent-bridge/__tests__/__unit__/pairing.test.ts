import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { CODE_TTL_MS, LOCK_FIRST_MS, MAX_FAILURES, Pairing } from '../../src/core/pairing.js';
import { FakeConnection, MemoryTokenStore, ORIGIN } from '../connection.fake.js';

/** A waiting tab: counts how many times it is asked for a code and keeps the token once paired. */
function waitTab(pairing: Pairing, tabId = 't1', origin = ORIGIN, connection = new FakeConnection(origin)) {
  const tab = { requests: 0, token: undefined as string | undefined, connection };
  pairing.wait(tabId, origin, connection, {
    requestCode: () => tab.requests++,
    onPaired: (token) => (tab.token = token),
  });
  return tab;
}

describe('Pairing', () => {
  let store: MemoryTokenStore;
  let pairing: Pairing;
  let requests: string[];

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'] });
    store = new MemoryTokenStore();
    requests = [];
    pairing = new Pairing(store, (origin) => requests.push(origin));
  });

  afterEach(() => mock.timers.reset());

  it('asks the waiting tab for a code and reports its origin', () => {
    const tab = waitTab(pairing);
    assert.equal(tab.requests, 1);
    assert.deepEqual(requests, [ORIGIN]);
  });

  it('pairs with the code the page offered, with a stored token valid only for its origin', () => {
    const tab = waitTab(pairing);
    pairing.offer('t1', '482913');
    assert.deepEqual(pairing.pair('482913'), { ok: true, tabId: 't1' });
    assert.match(tab.token ?? '', /^[0-9a-f]{64}$/);
    assert.deepEqual(store.tokens, { [ORIGIN]: [tab.token] });
    assert.equal(pairing.isValid(ORIGIN, tab.token!), true);
    assert.equal(pairing.isValid('https://other-site.com', tab.token!), false);
  });

  it('pairs nothing before the page offers its code', () => {
    waitTab(pairing);
    assert.deepEqual(pairing.pair('482913'), { ok: false, reason: 'wrong' });
  });

  it('the code decides which tab pairs; when two offer the same code, the second is asked for another', () => {
    const first = waitTab(pairing, 't1');
    const second = waitTab(pairing, 't2');
    pairing.offer('t1', '111111');
    pairing.offer('t2', '111111');
    assert.equal(second.requests, 2);
    pairing.offer('t2', '222222');
    assert.deepEqual(pairing.pair('222222'), { ok: true, tabId: 't2' });
    assert.equal(first.token, undefined);
  });

  it('answers none when no tab is waiting', () => {
    assert.deepEqual(pairing.pair('123456'), { ok: false, reason: 'none' });
  });

  it('after 5 consecutive failures, asks every tab for a new code and the old one stops working', () => {
    const tab = waitTab(pairing);
    pairing.offer('t1', '482913');
    for (let i = 0; i < MAX_FAILURES; i++) pairing.pair('000000');
    assert.equal(tab.requests, 2);
    pairing.offer('t1', '105377');
    assert.deepEqual(pairing.pair('105377'), { ok: false, reason: 'locked' });
    mock.timers.tick(LOCK_FIRST_MS);
    assert.deepEqual(pairing.pair('482913'), { ok: false, reason: 'wrong' });
    assert.equal(pairing.pair('105377').ok, true);
  });

  /** Each lock after another MAX_FAILURES wrong codes lasts twice as long. */
  it('doubles the pairing lock each time', () => {
    waitTab(pairing);
    for (let i = 0; i < MAX_FAILURES; i++) pairing.pair('000000');
    mock.timers.tick(LOCK_FIRST_MS);
    for (let i = 0; i < MAX_FAILURES; i++) pairing.pair('000000');
    mock.timers.tick(LOCK_FIRST_MS);
    assert.deepEqual(pairing.pair('000000'), { ok: false, reason: 'locked' });
    mock.timers.tick(LOCK_FIRST_MS);
    assert.deepEqual(pairing.pair('000000'), { ok: false, reason: 'wrong' });
  });

  it('rejects an expired code with expired and asks for a new one', () => {
    const tab = waitTab(pairing);
    pairing.offer('t1', '482913');
    mock.timers.tick(CODE_TTL_MS);
    assert.deepEqual(pairing.pair('482913'), { ok: false, reason: 'expired' });
    assert.equal(tab.requests, 2);
  });

  it('revoke invalidates the token', () => {
    const tab = waitTab(pairing);
    pairing.offer('t1', '482913');
    pairing.pair('482913');
    pairing.revoke(ORIGIN, tab.token!);
    assert.equal(pairing.isValid(ORIGIN, tab.token!), false);
    assert.deepEqual(store.tokens, { [ORIGIN]: [] });
  });

  it('cancel only removes the tab if it still belongs to that connection', () => {
    const first = waitTab(pairing, 't1');
    const reloaded = waitTab(pairing, 't1');
    pairing.cancel('t1', first.connection);
    pairing.offer('t1', '482913');
    assert.equal(pairing.pair('482913').ok, true);
    assert.equal(reloaded.token !== undefined, true);
  });

  it('loads the stored tokens', () => {
    const loaded = new Pairing(new MemoryTokenStore({ [ORIGIN]: ['abc'] }));
    assert.equal(loaded.isValid(ORIGIN, 'abc'), true);
  });
});
