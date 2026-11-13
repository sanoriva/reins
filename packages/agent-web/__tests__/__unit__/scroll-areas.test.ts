import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { scroll } from '../../src/index.js';
import { scrollTarget } from '../../src/scroll-areas.js';

describe('scrollTarget', () => {
  const box = { top: 1000, height: 5000, viewport: 1000 };

  it('moves 80 % of the visible height on down and up', () => {
    assert.deepEqual(scrollTarget('down', box), { target: 1800, atTop: false, atBottom: false });
    assert.deepEqual(scrollTarget('up', box), { target: 200, atTop: false, atBottom: false });
  });

  it('goes to the start and the end on top and bottom', () => {
    assert.deepEqual(scrollTarget('top', box), { target: 0, atTop: true, atBottom: false });
    assert.deepEqual(scrollTarget('bottom', box), { target: 4000, atTop: false, atBottom: true });
  });

  it('stops at the edges and reports reaching them', () => {
    assert.deepEqual(scrollTarget('down', { ...box, top: 3900 }), { target: 4000, atTop: false, atBottom: true });
    assert.deepEqual(scrollTarget('up', { ...box, top: 100 }), { target: 0, atTop: true, atBottom: false });
  });

  it('is at the top and the bottom at once when everything fits', () => {
    assert.deepEqual(scrollTarget('down', { top: 0, height: 500, viewport: 1000 }), { target: 0, atTop: true, atBottom: true });
  });
});

describe('scroll parameters', () => {
  const ok = (params: unknown) => scroll.params.safeParse(params).success;

  it('needs either to or text; in only goes with to', () => {
    assert.equal(ok({ to: 'down' }), true);
    assert.equal(ok({ to: 'down', in: 'comments' }), true);
    assert.equal(ok({ text: 'Ingredients' }), true);
    assert.equal(ok({}), false);
    assert.equal(ok({ to: 'down', text: 'x' }), false);
    assert.equal(ok({ text: 'x', in: 'comments' }), false);
    assert.equal(ok({ to: 'sideways' }), false);
  });
});
