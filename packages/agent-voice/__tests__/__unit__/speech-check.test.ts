import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MIN_SPEECH_MS, speechMs } from '../../src/speech-check.js';

describe('speechMs', () => {
  it('counts the 32 ms blocks where Silero hears voice (probability > 0.5)', () => {
    assert.equal(speechMs([0.9, 0.1, 0.6, 0.5, 0.99]), 3 * 32);
  });

  it('needs about 250 ms of voice to count as a sentence', () => {
    assert.ok(speechMs(Array(7).fill(0.9)) < MIN_SPEECH_MS);
    assert.ok(speechMs(Array(8).fill(0.9)) >= MIN_SPEECH_MS);
  });
});
