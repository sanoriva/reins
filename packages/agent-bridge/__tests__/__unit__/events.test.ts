import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EventQueue, MAX_QUEUED_EVENTS } from '../../src/core/events.js';

const tabState = { event: 'tab.state' as const, data: { state: 'active' as const } };

describe('EventQueue', () => {
  it('drain returns the events with their tab and empties the queue', () => {
    const queue = new EventQueue();
    queue.push('t1', tabState);
    assert.deepEqual(queue.drain(), [{ tabId: 't1', event: tabState }]);
    assert.deepEqual(queue.drain(), []);
  });

  it('onEvent reports every event until unsubscribed', () => {
    const queue = new EventQueue();
    const seen: string[] = [];
    const stop = queue.onEvent(({ tabId }) => seen.push(tabId));
    queue.push('t1', tabState);
    stop();
    queue.push('t2', tabState);
    assert.deepEqual(seen, ['t1']);
  });

  it('keeps only the latest 100 when nobody collects them', () => {
    const queue = new EventQueue();
    for (let i = 0; i <= MAX_QUEUED_EVENTS; i++) queue.push(`t${i}`, tabState);
    const items = queue.drain();
    assert.equal(items.length, MAX_QUEUED_EVENTS);
    assert.equal(items[0]?.tabId, 't1');
  });
});
