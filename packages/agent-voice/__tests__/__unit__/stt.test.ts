import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { maxTokens, mostLikelyLanguage } from '../../src/stt.js';

describe('mostLikelyLanguage', () => {
  /** Two positions; the last one counts. Language tokens: en=2, es=3, fr=4. */
  it('picks the most likely language after <|startoftranscript|> (the last position)', () => {
    const vocab = 6;
    const data = Float32Array.from([9, 9, 9, 9, 9, 9, 0, 0, 1.5, 4.2, 3.1, 0]);
    const logits = { dims: [1, 2, vocab], data } as never;
    assert.equal(mostLikelyLanguage(logits, { '<|en|>': 2, '<|es|>': 3, '<|fr|>': 4 }), 'es');
  });
});

describe('maxTokens', () => {
  it('grows with the length of the sentence', () => {
    assert.equal(maxTokens(new Float32Array(2 * 16_000)), 24);
    assert.equal(maxTokens(new Float32Array(10 * 16_000)), 88);
  });
});
