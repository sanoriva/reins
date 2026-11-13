import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseBridgeMessage, parsePageMessage, PROTOCOL_VERSION } from '../../src/index.js';

const ok = (result: { ok: boolean }, msg: unknown) => assert.equal(result.ok, true, JSON.stringify(msg));
const fails = (result: { ok: boolean }, msg: unknown) => assert.equal(result.ok, false, JSON.stringify(msg));

describe('parsePageMessage (received by the bridge)', () => {
  it('accepts hello, responses and events', () => {
    for (const msg of [
      { type: 'hello', protocolVersion: PROTOCOL_VERSION, tabId: 't1', nonce: '0123456789abcdef0123456789abcdef' },
      { type: 'pair_offer', code: '482913' },
      { id: 'a1', ok: true, result: null },
      { event: 'tab.state', data: { state: 'active' } },
    ]) {
      ok(parsePageMessage(JSON.stringify(msg)), msg);
    }
  });

  it('rejects broken JSON and messages only the bridge may send', () => {
    fails(parsePageMessage('{not json'), 'broken json');
    for (const msg of [
      { id: 'a1', action: 'get_state', page: 1 },
      { type: 'welcome', protocolVersion: 1, token: 'x' },
    ]) {
      fails(parsePageMessage(JSON.stringify(msg)), msg);
    }
  });

  it('ignores unknown fields, so compatible changes break nothing', () => {
    const result = parsePageMessage(JSON.stringify({ type: 'hello', protocolVersion: 1, tabId: 't1', nonce: '0123456789abcdef0123456789abcdef', future: true }));
    assert.equal(result.ok, true);
    assert.equal(result.ok && 'future' in result.value, false);
  });

  it('explains what fails', () => {
    const result = parsePageMessage(JSON.stringify({ type: 'hello', protocolVersion: 1 }));
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.error.length > 0);
  });
});

describe('parseBridgeMessage (received by the page)', () => {
  it('accepts orders and session messages', () => {
    for (const msg of [
      { id: 'a1', action: 'get_state', page: 1 },
      { type: 'welcome', protocolVersion: 1, token: 'abc' },
      { type: 'pair_required' },
      { type: 'unpaired' },
      { type: 'session_error', code: 'VERSION_MISMATCH', message: 'Version 2 not supported' },
    ]) {
      ok(parseBridgeMessage(JSON.stringify(msg)), msg);
    }
  });

  it('rejects messages only the page may send', () => {
    for (const msg of [
      { id: 'a1', ok: true, result: 1 },
      { event: 'tab.state', data: { state: 'active' } },
    ]) {
      fails(parseBridgeMessage(JSON.stringify(msg)), msg);
    }
  });
});
