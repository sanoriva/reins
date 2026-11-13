import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { z } from 'zod';

import { type ActionContext, buildUrl, navigateAction } from '../../src/index.js';

const context: ActionContext = { route: '/', title: 'Home', page: 1, actions: [], content: undefined };

const routes = [
  { key: 'home', path: '/', title: 'Home', description: 'Home screen' },
  {
    key: 'article',
    path: '/article/:id',
    title: 'Article',
    description: 'An article',
    params: z.object({
      id: z.enum(['coffee', 'tea']).describe('Which article'),
      query: z.string().describe('What to search for').optional(),
    }),
  },
];

/** Runs navigate the way the pipeline does: validates with its zod schema and calls run. */
async function navigate(params: unknown, go: (url: string) => unknown = () => {}) {
  const action = navigateAction({ routes, go: go as never });
  return action.run(action.params.parse(params), context);
}

describe('buildUrl', () => {
  it('fills the path :params and puts the rest in the query string', () => {
    assert.equal(buildUrl('/article/:id', { id: 'tea', query: 'hot water' }), '/article/tea?query=hot+water');
  });

  it('encodes values and skips empty ones', () => {
    assert.equal(buildUrl('/a/:id', { id: 'a/b c', page: undefined }), '/a/a%2Fb%20c');
    assert.equal(buildUrl('/'), '/');
  });

  it('throws INVALID_PARAMS when a path parameter is missing', () => {
    assert.throws(() => buildUrl('/article/:id', {}), { code: 'INVALID_PARAMS' });
  });

  /** '.' and '..' are not encoded and would move the URL to another path once the browser resolves it. */
  it('throws INVALID_PARAMS for an empty, "." or ".." path parameter', () => {
    for (const id of ['', '.', '..']) assert.throws(() => buildUrl('/users/:id/posts', { id }), { code: 'INVALID_PARAMS' });
    assert.equal(buildUrl('/users/:id', { id: '...' }), '/users/...');
  });
});

describe('navigate', () => {
  it('lists every screen with its parameters in the description', () => {
    const { description, inputSchema } = navigateAction({ routes, go: () => {} }).definition;
    assert.match(description, /- home \(Home\): Home screen\. No parameters\./);
    assert.match(description, /- article \(Article\): An article\. Parameters: .*"enum":\["coffee","tea"\]/);
    assert.deepEqual((inputSchema.properties as any).to.enum, ['home', 'article']);
  });

  it('navigates to the URL built from the screen parameters', async () => {
    const urls: string[] = [];
    const result = await navigate({ to: 'article', params: { id: 'tea' } }, (url) => void urls.push(url));
    assert.deepEqual(urls, ['/article/tea']);
    assert.deepEqual(result, { route: '/article/tea' });
  });

  it('needs no parameters for a screen that has none', async () => {
    assert.deepEqual(await navigate({ to: 'home' }), { route: '/' });
  });

  it('only accepts defined keys', () => {
    assert.throws(() => navigateAction({ routes, go: () => {} }).params.parse({ to: '/admin' }));
  });

  it('answers INVALID_PARAMS without navigating when the parameters do not match the screen', async () => {
    let went = false;
    await assert.rejects(
      navigate({ to: 'article', params: { id: 'pizza' } }, () => void (went = true)),
      { code: 'INVALID_PARAMS' },
    );
    assert.equal(went, false);
  });

  it('answers NOT_AVAILABLE when the app refuses to navigate (go returns false)', async () => {
    await assert.rejects(navigate({ to: 'home' }, async () => false), { code: 'NOT_AVAILABLE' });
  });

  it('throws at creation when a parameter has no description', () => {
    const route = { key: 'a', path: '/a/:id', description: 'x', params: z.object({ id: z.string() }) };
    assert.throws(() => navigateAction({ routes: [route], go: () => {} }), /"id" of screen "a" has no description/);
  });

  it('throws at creation when a path :param is not in params', () => {
    const noParams = { key: 'a', path: '/a/:id', description: 'x' };
    const other = { ...noParams, params: z.object({ slug: z.string().describe('y') }) };
    assert.throws(() => navigateAction({ routes: [noParams], go: () => {} }), /uses :id in its path, but it is not in params/);
    assert.throws(() => navigateAction({ routes: [other], go: () => {} }), /uses :id/);
  });

  it('rejects duplicate keys and an empty list of screens', () => {
    assert.throws(() => navigateAction({ routes: [], go: () => {} }));
    assert.throws(() => navigateAction({ routes: [routes[0]!, routes[0]!], go: () => {} }), /Duplicate screen keys/);
  });
});
