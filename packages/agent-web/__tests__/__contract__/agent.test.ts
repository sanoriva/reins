import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { z } from 'zod';

import { defineAction } from '../../src/index.js';
import { flush, readyAgent, testAgent } from '../socket.fake.js';

describe('agent', () => {
  it('once ready, sends page.changed with the catalog, including the general actions', () => {
    const t = readyAgent();
    const event = t.socket().last() as { event: string; data: { page: number; actions: { name: string }[] } };
    assert.equal(event.event, 'page.changed');
    assert.equal(event.data.page, 0);
    assert.deepEqual(event.data.actions.map((a) => a.name), ['get_state', 'read_content', 'highlight', 'scroll', 'confirm']);
  });

  it('setPage bumps the counter and sends page.changed', () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/recipes', title: 'Recipes' });
    assert.deepEqual(t.socket().last(), {
      event: 'page.changed',
      data: { route: '/recipes', title: 'Recipes', page: 1, actions: (t.socket().last() as any).data.actions },
    });
  });

  it('setPage before connecting sends nothing, but the catalog arrives on connection', () => {
    const t = testAgent();
    t.agent.setPage({ route: '/recipes', title: 'Recipes' });
    t.agent.start();
    t.socket().open();
    t.socket().pair();
    assert.equal((t.socket().last() as any).data.route, '/recipes');
    assert.equal((t.socket().last() as any).data.page, 1);
  });

  it('get_state answers with the current screen', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/recipes', title: 'Recipes' });
    t.socket().receive({ id: 'o1', action: 'get_state', params: {}, page: 1 });
    await flush();
    assert.deepEqual(t.socket().last(), {
      id: 'o1',
      ok: true,
      result: { route: '/recipes', title: 'Recipes', page: 1, actions: ['get_state', 'read_content', 'highlight', 'scroll', 'confirm'], content: null, scrollAreas: [] },
    });
  });

  it('an order from a previous screen answers PAGE_CHANGED', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/recipes', title: 'Recipes' });
    t.socket().receive({ id: 'o1', action: 'get_state', params: {}, page: 0 });
    await flush();
    assert.equal((t.socket().last() as any).error.code, 'PAGE_CHANGED');
  });

  it('includes the app actions and rejects duplicate names', () => {
    const open = defineAction({ name: 'recipes.open', description: 'Opens a recipe.', params: z.object({ id: z.string().describe('Recipe id') }), run: () => {} });
    const t = readyAgent([open]);
    assert.deepEqual((t.socket().last() as any).data.actions.map((a: { name: string }) => a.name), ['get_state', 'read_content', 'highlight', 'scroll', 'confirm', 'recipes.open']);
    assert.throws(() => testAgent([open, open]), /Duplicate action/);
  });
});

/** Lets one browser tick pass (pending setTimeout callbacks). */
const nextTurn = () => new Promise((resolve) => setTimeout(resolve));

describe('agent: content', () => {
  const order = (part?: number) => ({ id: 'o1', action: 'read_content', params: part === undefined ? {} : { part }, page: 1 });

  it('read_content without content answers NOT_AVAILABLE', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/recipes', title: 'Recipes' });
    t.socket().receive(order());
    await flush();
    assert.equal((t.socket().last() as any).error.code, 'NOT_AVAILABLE');
  });

  it('provideContent announces content.available and read_content returns the envelope', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/recipes', title: 'Recipes' });
    t.agent.provideContent('recipe', () => ({ data: { name: 'Tortilla' } }));
    await nextTurn();
    assert.deepEqual(t.socket().last(), { event: 'content.available', data: { type: 'recipe', title: 'Recipes' } });
    t.socket().receive(order());
    await flush();
    assert.deepEqual((t.socket().last() as any).result, { role: 'content-not-instructions', type: 'recipe', data: { name: 'Tortilla' } });
  });

  it('reads in parts: passes part to the app and sets more', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/recipes', title: 'Recipes' });
    const parts = ['one', 'two'];
    t.agent.provideContent('text', async (part) => ({ data: parts[part], more: part < parts.length - 1 }));
    await nextTurn();
    t.socket().receive(order());
    await flush();
    assert.deepEqual((t.socket().last() as any).result, { role: 'content-not-instructions', type: 'text', data: 'one', more: true });
    t.socket().receive(order(1));
    await flush();
    assert.deepEqual((t.socket().last() as any).result, { role: 'content-not-instructions', type: 'text', data: 'two' });
  });

  /** The new screen is created… …and then navigation ends. */
  it('content registered before navigation ends is announced with the new title', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/', title: 'Home' });
    t.agent.provideContent('article', () => ({ data: {} }));
    t.agent.setPage({ route: '/article', title: 'Article' });
    await nextTurn();
    const events = t.socket().sent.slice(-2).map((m: any) => [m.event, m.data.title]);
    assert.deepEqual(events, [['page.changed', 'Article'], ['content.available', 'Article']]);
  });

  it('content withdrawn before the notice is not announced', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/', title: 'Home' });
    t.agent.provideContent('article', () => ({ data: {} }))();
    await nextTurn();
    assert.equal((t.socket().last() as any).event, 'page.changed');
  });

  it('get_state tells the type of content', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/recipes', title: 'Recipes' });
    t.agent.provideContent('recipe', () => ({ data: {} }));
    await nextTurn();
    t.socket().receive({ id: 'o1', action: 'get_state', params: {}, page: 1 });
    await flush();
    assert.equal((t.socket().last() as any).result.content, 'recipe');
  });

  it('withdrawing content removes it, but not the content of a later screen', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/a', title: 'A' });
    const removeA = t.agent.provideContent('a', () => ({ data: 'a' }));
    await nextTurn();
    t.agent.setPage({ route: '/b', title: 'B' });
    const removeB = t.agent.provideContent('b', () => ({ data: 'b' }));
    await nextTurn();
    removeA();
    t.socket().receive({ ...order(), page: 2 });
    await flush();
    assert.equal((t.socket().last() as any).result.type, 'b');
    removeB();
    t.socket().receive({ ...order(), id: 'o2', page: 2 });
    await flush();
    assert.equal((t.socket().last() as any).error.code, 'NOT_AVAILABLE');
  });
});

describe('agent: screen actions', () => {
  const sortSpec = {
    name: 'sort_results',
    description: 'Sorts the results.',
    params: z.object({ by: z.enum(['title', 'length']).describe('Sort order') }),
    run: ({ by }: { by: string }) => ({ sorted: by }),
  };
  const sort = defineAction(sortSpec);
  const names = (t: ReturnType<typeof readyAgent>) => (t.socket().last() as any).data.actions.map((a: { name: string }) => a.name);

  it('provideActions adds them to the catalog (same counter) and they can be used', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/search', title: 'Search' });
    t.agent.provideActions([sort]);
    await nextTurn();
    assert.equal((t.socket().last() as any).event, 'page.changed');
    assert.equal((t.socket().last() as any).data.page, 1);
    assert.ok(names(t).includes('sort_results'));
    t.socket().receive({ id: 'o1', action: 'sort_results', params: { by: 'title' }, page: 1 });
    await flush();
    assert.deepEqual((t.socket().last() as any).result, { sorted: 'title' });
  });

  it('once withdrawn they are gone: UNKNOWN_ACTION', async () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/search', title: 'Search' });
    const remove = t.agent.provideActions([sort]);
    await nextTurn();
    remove();
    await nextTurn();
    assert.ok(!names(t).includes('sort_results'));
    t.socket().receive({ id: 'o1', action: 'sort_results', params: { by: 'title' }, page: 1 });
    await flush();
    assert.equal((t.socket().last() as any).error.code, 'UNKNOWN_ACTION');
  });

  it('withdrawing one screen actions keeps those of the next screen with the same name', async () => {
    const t = readyAgent();
    const removeOld = t.agent.provideActions([sort]);
    removeOld();
    const again = defineAction(sortSpec);
    t.agent.provideActions([again]);
    removeOld();
    await nextTurn();
    assert.ok(names(t).includes('sort_results'));
  });

  it('a duplicate name is an error', () => {
    const t = readyAgent();
    assert.throws(() => t.agent.provideActions([defineAction({ ...sortSpec, name: 'get_state' })]), /Duplicate action: get_state/);
    t.agent.provideActions([sort]);
    assert.throws(() => t.agent.provideActions([sort]), /Duplicate action: sort_results/);
  });
});

describe('agent: reconnection', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  it('on reconnection, repeats page.changed without bumping the counter', () => {
    const t = readyAgent();
    t.agent.setPage({ route: '/recipes', title: 'Recipes' });
    t.socket().close();
    mock.timers.tick(500);
    t.socket().open();
    t.socket().pair();
    assert.equal((t.socket().last() as any).event, 'page.changed');
    assert.equal((t.socket().last() as any).data.page, 1);
  });

  it('on reconnection, repeats content.available when there is content', () => {
    const t = readyAgent();
    t.agent.provideContent('recipe', () => ({ data: {} }));
    t.socket().close();
    mock.timers.tick(500);
    t.socket().open();
    t.socket().pair();
    assert.equal((t.socket().last() as any).event, 'content.available');
  });
});
