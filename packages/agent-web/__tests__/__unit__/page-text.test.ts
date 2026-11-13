import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { looksVisible, type VisibleCandidate } from '../../src/page-text.js';

/** A fake element: what the browser would answer for checkVisibility and the element's box. */
function element(box: Partial<DOMRect>, rendered = true): VisibleCandidate & { asked: CheckVisibilityOptions[] } {
  const asked: CheckVisibilityOptions[] = [];
  return {
    asked,
    checkVisibility: (options?: CheckVisibilityOptions) => (asked.push(options ?? {}), rendered),
    getBoundingClientRect: () => ({ x: 0, y: 0, top: 0, left: 0, width: 200, height: 20, right: 200, bottom: 20, ...box }) as DOMRect,
  };
}

const top = { x: 0, y: 0 };

describe('looksVisible', () => {
  it('accepts an ordinary element on screen', () => {
    assert.equal(looksVisible(element({}), top), true);
  });

  it('asks the browser about display, visibility and opacity', () => {
    const el = element({}, false);
    assert.equal(looksVisible(el, top), false);
    assert.deepEqual(el.asked, [{ visibilityProperty: true, opacityProperty: true }]);
  });

  it('rejects boxes of 1 px or less: zero size, font-size 0 and the sr-only pattern', () => {
    assert.equal(looksVisible(element({ width: 0, height: 0, right: 0, bottom: 0 }), top), false);
    assert.equal(looksVisible(element({ width: 1, height: 1, right: 1, bottom: 1 }), top), false);
    assert.equal(looksVisible(element({ height: 0, bottom: 0 }), top), false);
  });

  it('rejects an element placed entirely before the start of the page (left: -9999px)', () => {
    assert.equal(looksVisible(element({ left: -9999, right: -9799 }), top), false);
  });

  it('accepts an element above the viewport when the page is scrolled down, since it is on the page', () => {
    assert.equal(looksVisible(element({ top: -500, bottom: -480 }), { x: 0, y: 1000 }), true);
  });
});
