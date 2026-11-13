import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { z } from 'zod';

import { ActionError, defineAction } from '../../src/index.js';
import { dispatch } from '../../src/dispatcher.js';

const echo = defineAction({
  name: 'echo',
  description: 'Returns the text.',
  params: z.object({ text: z.string().describe('Text to return') }),
  run: ({ text }) => text,
});
const missing = defineAction({
  name: 'missing',
  description: 'Fails with its own code.',
  params: z.object({}),
  run: () => {
    throw new ActionError('TEXT_NOT_FOUND', 'Not found');
  },
});
const broken = defineAction({
  name: 'broken',
  description: 'Fails without a code.',
  params: z.object({}),
  run: () => {
    throw new Error('Something broke');
  },
});
const silent = defineAction({ name: 'silent', description: 'Returns nothing.', params: z.object({}), run: () => {} });

const actions = new Map([echo, missing, broken, silent].map((a) => [a.definition.name, a]));
const context = { route: '/', title: 'Home', page: 2, actions: [...actions.keys()] };
const order = (action: string, params: Record<string, unknown> = {}, page = 2) => ({ id: 'o1', action, params, page });
const code = (response: Awaited<ReturnType<typeof dispatch>>) => (response.ok ? 'OK' : response.error.code);

describe('dispatch', () => {
  it('runs the action and returns its result', async () => {
    assert.deepEqual(await dispatch(order('echo', { text: 'hello' }), actions, context), { id: 'o1', ok: true, result: 'hello' });
  });

  it('sends an empty result as null', async () => {
    assert.deepEqual(await dispatch(order('silent'), actions, context), { id: 'o1', ok: true, result: null });
  });

  it('answers PAGE_CHANGED and does not run when the screen changed', async () => {
    assert.equal(code(await dispatch(order('echo', { text: 'hello' }, 1), actions, context)), 'PAGE_CHANGED');
  });

  it('answers UNKNOWN_ACTION for an action that does not exist', async () => {
    assert.equal(code(await dispatch(order('nope'), actions, context)), 'UNKNOWN_ACTION');
  });

  it('answers INVALID_PARAMS for invalid parameters', async () => {
    assert.equal(code(await dispatch(order('echo', { text: 1 }), actions, context)), 'INVALID_PARAMS');
  });

  it('returns the code of an ActionError, and NOT_AVAILABLE for any other error', async () => {
    assert.equal(code(await dispatch(order('missing'), actions, context)), 'TEXT_NOT_FOUND');
    const response = await dispatch(order('broken'), actions, context);
    assert.equal(code(response), 'NOT_AVAILABLE');
    assert.equal(!response.ok && response.error.message, 'Something broke');
  });
});
