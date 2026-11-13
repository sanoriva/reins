import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Tabs } from '../../src/core/tabs.js';
import { FakeConnection, ORIGIN } from '../connection.fake.js';

const highlight = {
  name: 'highlight',
  description: 'Highlights a passage.',
  inputSchema: { type: 'object' as const },
  scope: 'general' as const,
  effect: 'none' as const,
};

describe('Tabs', () => {
  it('a new tab starts active, at counter 0 and with no actions', () => {
    const tabs = new Tabs();
    tabs.add('t1', new FakeConnection());
    assert.deepEqual(tabs.list(), [
      { tabId: 't1', origin: ORIGIN, page: 0, route: '', title: '', actions: [], state: 'active' },
    ]);
  });

  it('page.changed stores the counter, route, title and catalog', () => {
    const tabs = new Tabs();
    tabs.add('t1', new FakeConnection());
    tabs.pageChanged('t1', { route: '/recipes', title: 'Recipes', page: 3, actions: [highlight] });
    assert.deepEqual(tabs.list()[0], {
      tabId: 't1',
      origin: ORIGIN,
      page: 3,
      route: '/recipes',
      title: 'Recipes',
      actions: [highlight],
      state: 'active',
    });
  });

  it('tab.state changes the state; closed changes nothing', () => {
    const tabs = new Tabs();
    tabs.add('t1', new FakeConnection());
    tabs.tabState('t1', 'background');
    tabs.tabState('t1', 'closed');
    assert.equal(tabs.list()[0]?.state, 'background');
  });

  it('a reload replaces the connection and the old one can no longer remove the tab', () => {
    const tabs = new Tabs();
    const old = new FakeConnection();
    const reloaded = new FakeConnection();
    tabs.add('t1', old);
    tabs.add('t1', reloaded);
    assert.equal(tabs.remove('t1', old), false);
    assert.equal(tabs.get('t1')?.connection, reloaded);
    assert.equal(tabs.remove('t1', reloaded), true);
    assert.deepEqual(tabs.list(), []);
  });
});
