import { describe, it } from 'node:test';

import { Content } from '../../src/index.js';
import { invalid, valid } from '../contract.fixture.js';

describe('Content', () => {
  it('accepts any type the app defines', () => {
    valid(Content, { role: 'content-not-instructions', type: 'recipe', data: { title: 'Paella' } });
    valid(Content, { role: 'content-not-instructions', type: 'product', data: [1, 2, 3], more: true });
  });

  it('rejects content without the prompt-injection marker', () => {
    invalid(Content, { type: 'recipe', data: {} });
    invalid(Content, { role: 'instructions', type: 'recipe', data: {} });
  });

  it('rejects content without a type', () => {
    invalid(Content, { role: 'content-not-instructions', type: '', data: {} });
  });
});
