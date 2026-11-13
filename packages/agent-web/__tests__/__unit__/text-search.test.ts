import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findText } from '../../src/text-search.js';

describe('findText', () => {
  it('finds a passage inside a text', () => {
    const match = findText(['Dear world'], 'world');
    assert.deepEqual(match, { start: { piece: 0, offset: 5 }, end: { piece: 0, offset: 10 }, next: 9 });
  });

  it('finds text split across several pieces (tags)', () => {
    const match = findText(['Please ', 'read it', ' to me now'], 'se read it to');
    assert.deepEqual(match?.start, { piece: 0, offset: 4 });
    assert.deepEqual(match?.end, { piece: 2, offset: 3 });
  });

  it('ignores different whitespace and line breaks, also between blocks with no space', () => {
    assert.ok(findText(['one\n   two'], 'one two'));
    assert.ok(findText(['one', 'two'], 'one two'));
    assert.ok(findText(['one two'], 'onetwo'));
  });

  it('ignores letter case', () => {
    assert.ok(findText(['Your AI controls this page'], 'your ai CONTROLS'));
  });

  it('continues from `from` with repeated text and wraps around to the start', () => {
    const pieces = ['step one, step two, step six'];
    const first = findText(pieces, 'step')!;
    const second = findText(pieces, 'step', first.next)!;
    assert.equal(first.start.offset, 0);
    assert.equal(second.start.offset, 10);
    const third = findText(pieces, 'step', second.next)!;
    assert.equal(third.start.offset, 20);
    assert.equal(findText(pieces, 'step', third.next)!.start.offset, 0);
  });

  it('finds neither missing text nor an empty passage', () => {
    assert.equal(findText(['Dear world'], 'goodbye'), undefined);
    assert.equal(findText(['Dear world'], '   '), undefined);
  });
});
