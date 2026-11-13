import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { z } from 'zod';

import { defineAction } from '../../src/index.js';

describe('defineAction', () => {
  it('derives the JSON Schema from the zod parameters; defaults to scope page and effect none', () => {
    const search = defineAction({
      name: 'recipes.search',
      description: 'Searches recipes.',
      params: z.object({ query: z.string().describe('What to search for') }),
      run: () => [],
    });
    assert.deepEqual(search.definition, {
      name: 'recipes.search',
      description: 'Searches recipes.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'What to search for' } },
        required: ['query'],
      },
      scope: 'page',
      effect: 'none',
    });
  });

  it('makes a parameter with a default value optional for the AI', () => {
    const list = defineAction({
      name: 'recipes.list',
      description: 'Lists recipes.',
      params: z.object({ page: z.int().default(0).describe('Page'), query: z.string().describe('What to search for') }),
      run: () => [],
    });
    assert.deepEqual(list.definition.inputSchema.required, ['query']);
  });

  it('throws at definition time when a parameter has no description', () => {
    assert.throws(
      () => defineAction({ name: 'a', description: 'x', params: z.object({ id: z.string() }), run: () => {} }),
      /Parameter "id" of action "a" has no description/,
    );
  });

  it('rejects names MCP does not allow', () => {
    assert.throws(() => defineAction({ name: 'search recipes', description: 'x', params: z.object({}), run: () => {} }));
  });
});
