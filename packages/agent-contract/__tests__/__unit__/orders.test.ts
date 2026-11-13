import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Order, OrderResponse } from '../../src/index.js';
import { invalid, valid } from '../contract.fixture.js';

describe('Order', () => {
  it('accepts an order with its screen counter', () => {
    valid(Order, { id: 'a1', action: 'highlight', params: { text: 'Hello' }, page: 3 });
  });

  it('defaults params to an empty object', () => {
    assert.deepEqual(Order.parse({ id: 'a1', action: 'get_state', page: 1 }).params, {});
  });

  it('rejects orders without a counter, with a negative counter, or with an empty id or action', () => {
    invalid(Order, { id: 'a1', action: 'get_state' });
    invalid(Order, { id: 'a1', action: 'get_state', page: -1 });
    invalid(Order, { id: '', action: 'get_state', page: 1 });
    invalid(Order, { id: 'a1', action: '', page: 1 });
  });
});

describe('OrderResponse', () => {
  it('accepts success and error', () => {
    valid(OrderResponse, { id: 'a1', ok: true, result: { visible: true } });
    valid(OrderResponse, { id: 'a1', ok: false, error: { code: 'TIMEOUT', message: 'No answer' } });
  });

  it('accepts action-specific codes', () => {
    valid(OrderResponse, { id: 'a1', ok: false, error: { code: 'TEXT_NOT_FOUND', message: 'Not found' } });
  });

  it('accepts INVALID_CODE with the attempts left', () => {
    valid(OrderResponse, {
      id: 'a9',
      ok: false,
      error: { code: 'INVALID_CODE', message: 'Wrong code', attemptsLeft: 2 },
    });
  });

  it('rejects codes that are not UPPER_SNAKE_CASE and errors without a message', () => {
    invalid(OrderResponse, { id: 'a1', ok: false, error: { code: 'text not found', message: 'x' } });
    invalid(OrderResponse, { id: 'a1', ok: false, error: { code: 'TIMEOUT' } });
  });
});
