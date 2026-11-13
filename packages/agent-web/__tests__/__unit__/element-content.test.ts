import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { joinBlocks, splitParts } from '../../src/element-content.js';

describe('joinBlocks', () => {
  it('joins the text of one block even when it is split across tags', () => {
    const p = {};
    assert.deepEqual(joinBlocks([{ text: 'Ask it ', block: p }, { text: 'to', block: p }, { text: ' read it', block: p }]), ['Ask it to read it']);
  });

  it('starts a new block for every different element and normalises whitespace', () => {
    const h = {};
    const p1 = {};
    const p2 = {};
    const blocks = joinBlocks([
      { text: '  The coffee  ', block: h },
      { text: 'First\n   paragraph.', block: p1 },
      { text: 'Second.', block: p2 },
    ]);
    assert.deepEqual(blocks, ['The coffee', 'First paragraph.', 'Second.']);
  });

  it('drops whitespace-only blocks (HTML indentation)', () => {
    const article = {};
    const p = {};
    assert.deepEqual(joinBlocks([{ text: '\n  ', block: article }, { text: 'Hello', block: p }, { text: '\n', block: article }]), ['Hello']);
  });
});

describe('splitParts', () => {
  it('groups blocks up to the size and starts a new part when it is exceeded', () => {
    assert.deepEqual(splitParts(['aaaa', 'bbbb', 'cccc'], 8), [['aaaa', 'bbbb'], ['cccc']]);
  });

  it('puts a block longer than the size alone and whole', () => {
    assert.deepEqual(splitParts(['a', 'bbbbbbbbbbbb', 'c'], 5), [['a'], ['bbbbbbbbbbbb'], ['c']]);
  });

  it('returns no parts without blocks', () => {
    assert.deepEqual(splitParts([], 10), []);
  });
});
