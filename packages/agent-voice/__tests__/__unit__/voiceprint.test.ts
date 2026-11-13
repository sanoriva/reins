import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENROLL_SENTENCES, MIN_LEARN_MS, similarity, type StoredVoiceprint, Voiceprint } from '../../src/voiceprint.js';

const USER = [1, 0.2, 0];
const USER_AGAIN = [0.9, 0.3, 0.05];
const OTHER = [0, 0.1, 1];

function memory(initial?: StoredVoiceprint) {
  const store = { saved: initial, load: () => store.saved, save: (v: StoredVoiceprint) => (store.saved = v) };
  return store;
}

describe('Voiceprint', () => {
  it('lets every sentence through while it learns, and is ready after the first sentences', () => {
    const print = new Voiceprint(memory());
    for (let i = 0; i < ENROLL_SENTENCES; i++) {
      assert.equal(print.ready, false);
      assert.equal(print.judge(i === 1 ? OTHER : USER, MIN_LEARN_MS, true).user, true);
    }
    assert.equal(print.ready, false);
    print.judge(USER_AGAIN, MIN_LEARN_MS, true);
    assert.equal(print.ready, true);
  });

  it('once learned, keeps the user and drops other voices', () => {
    const print = new Voiceprint(memory({ embedding: USER, sentences: ENROLL_SENTENCES }));
    assert.equal(print.judge(USER_AGAIN, 0, false).user, true);
    assert.equal(print.judge(OTHER, 0, false).user, false);
  });

  it('learns only long sentences the user started, and remembers them', () => {
    const store = memory({ embedding: USER, sentences: 1 });
    const print = new Voiceprint(store);
    print.judge(USER_AGAIN, MIN_LEARN_MS - 1, true);
    print.judge(USER_AGAIN, MIN_LEARN_MS, false);
    assert.equal(store.saved?.sentences, 1);
    print.judge(USER_AGAIN, MIN_LEARN_MS, true);
    assert.equal(store.saved?.sentences, 2);
    assert.equal(new Voiceprint(store).ready, false);
  });

  it('measures how alike two voices are', () => {
    assert.ok(similarity(USER, USER_AGAIN) > 0.9);
    assert.ok(similarity(USER, OTHER) < 0.1);
  });
});
