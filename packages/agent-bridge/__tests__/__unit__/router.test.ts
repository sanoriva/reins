import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { ORDER_TIMEOUT_MS, Router } from '../../src/core/router.js';
import { Tabs } from '../../src/core/tabs.js';
import { FakeConnection } from '../connection.fake.js';

describe('Router', () => {
  let tabs: Tabs;
  let router: Router;
  let connection: FakeConnection;

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout'] });
    tabs = new Tabs();
    router = new Router(tabs);
    connection = new FakeConnection();
    tabs.add('t1', connection);
    tabs.pageChanged('t1', { route: '/', title: 'Home', page: 5, actions: [] });
  });

  afterEach(() => mock.timers.reset());

  it('sends the order with an id and the last screen counter, and delivers the response', async () => {
    const pending = router.send('t1', 'get_state');
    assert.deepEqual(connection.last(), { id: 'o1', action: 'get_state', params: {}, page: 5 });
    assert.equal(router.resolve('t1', { id: 'o1', ok: true, result: { route: '/' } }), true);
    assert.deepEqual(await pending, { id: 'o1', ok: true, result: { route: '/' } });
  });

  it('answers TIMEOUT after 10 s without a response and ignores the late one', async () => {
    const pending = router.send('t1', 'get_state');
    mock.timers.tick(ORDER_TIMEOUT_MS);
    const response = await pending;
    assert.equal(!response.ok && response.error.code, 'TIMEOUT');
    assert.equal(router.resolve('t1', { id: 'o1', ok: true, result: null }), false);
  });

  it('answers TAB_DISCONNECTED for a tab that is not connected', async () => {
    const response = await router.send('t9', 'get_state');
    assert.equal(!response.ok && response.error.code, 'TAB_DISCONNECTED');
  });

  it('answers TAB_DISCONNECTED to running orders when the connection drops', async () => {
    const pending = router.send('t1', 'get_state');
    router.connectionGone(connection);
    const response = await pending;
    assert.equal(!response.ok && response.error.code, 'TAB_DISCONNECTED');
  });

  it('ignores responses with an unknown id or from another tab', () => {
    void router.send('t1', 'get_state');
    assert.equal(router.resolve('t1', { id: 'o99', ok: true, result: null }), false);
    assert.equal(router.resolve('t2', { id: 'o1', ok: true, result: null }), false);
  });
});
