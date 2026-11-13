import { describe, it } from 'node:test';

import { Hello, PairOffer, PairRequired, PROTOCOL_VERSION, SessionError, Welcome } from '../../src/index.js';
import { invalid, valid } from '../contract.fixture.js';

describe('session', () => {
  it('hello carries the version, the tab and a nonce; the token id is optional and the token itself never travels', () => {
    valid(Hello, { type: 'hello', protocolVersion: PROTOCOL_VERSION, tabId: 't1', nonce: '0123456789abcdef0123456789abcdef' });
    valid(Hello, { type: 'hello', protocolVersion: PROTOCOL_VERSION, tabId: 't1', nonce: '0123456789abcdef0123456789abcdef', tokenId: '0123456789abcdef' });
    invalid(Hello, { type: 'hello', protocolVersion: PROTOCOL_VERSION, tabId: 't1' });
    invalid(Hello, { type: 'hello', protocolVersion: PROTOCOL_VERSION, tabId: 't1', nonce: '0123456789abcdef0123456789abcdef', tokenId: 'not-hex' });
    invalid(Hello, { type: 'hello', protocolVersion: PROTOCOL_VERSION });
    invalid(Hello, { type: 'hello', protocolVersion: 0, tabId: 't1' });
  });

  it('the page generates the code and sends it with pair_offer: 6 digits', () => {
    valid(PairRequired, { type: 'pair_required' });
    valid(PairOffer, { type: 'pair_offer', code: '482913' });
    invalid(PairOffer, { type: 'pair_offer', code: '48291' });
    invalid(PairOffer, { type: 'pair_offer', code: '48291a' });
  });

  it('welcome hands over the token only after pairing', () => {
    valid(Welcome, { type: 'welcome', protocolVersion: 1, token: 'abc' });
    valid(Welcome, { type: 'welcome', protocolVersion: 1 });
    invalid(Welcome, { type: 'welcome', protocolVersion: 1, token: '' });
  });

  it('session_error only with its own codes', () => {
    valid(SessionError, { type: 'session_error', code: 'VERSION_MISMATCH', message: 'Version 2 not supported' });
    invalid(SessionError, { type: 'session_error', code: 'OTHER', message: 'x' });
  });
});
