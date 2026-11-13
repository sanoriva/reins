import assert from 'node:assert/strict';

type Schema = { safeParse(value: unknown): { success: boolean } };

export const valid = (schema: Schema, value: unknown) =>
  assert.equal(schema.safeParse(value).success, true, JSON.stringify(value));

export const invalid = (schema: Schema, value: unknown) =>
  assert.equal(schema.safeParse(value).success, false, JSON.stringify(value));

export const highlight = {
  name: 'highlight',
  description: 'Highlights the passage you are reading out loud.',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  scope: 'general',
  effect: 'none',
};
