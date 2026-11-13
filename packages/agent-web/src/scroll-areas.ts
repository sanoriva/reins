/**
 * The AI only scrolls the page and the boxes the app marks with `data-agent-scroll="name"`; any other
 * scrollable box is out of its reach.
 */
export const SCROLL_ATTRIBUTE = 'data-agent-scroll';

export interface ScrollBox {
  top: number;
  height: number;
  viewport: number;
}

export type ScrollTo = 'up' | 'down' | 'top' | 'bottom';

/** One screen minus a margin, so part of the previous view stays visible. */
const PAGE_STEP = 0.8;

export function scrollTarget(to: ScrollTo, { top, height, viewport }: ScrollBox) {
  const max = Math.max(0, height - viewport);
  const wanted = { up: top - viewport * PAGE_STEP, down: top + viewport * PAGE_STEP, top: 0, bottom: max }[to];
  const target = Math.round(Math.min(max, Math.max(0, wanted)));
  return { target, atTop: target <= 0, atBottom: target >= max - 1 };
}

/** The marked boxes currently visible, by name. None without a browser (SSR, tests). */
export function scrollAreas(): Map<string, HTMLElement> {
  const areas = new Map<string, HTMLElement>();
  if (typeof document === 'undefined') return areas;
  for (const element of document.querySelectorAll<HTMLElement>(`[${SCROLL_ATTRIBUTE}]`)) {
    const name = element.getAttribute(SCROLL_ATTRIBUTE)?.trim();
    if (name && !areas.has(name) && element.checkVisibility()) areas.set(name, element);
  }
  return areas;
}

export function scrollBy(to: ScrollTo, area?: HTMLElement) {
  const scroller = area ?? document.scrollingElement ?? document.documentElement;
  const { target, atTop, atBottom } = scrollTarget(to, {
    top: scroller.scrollTop,
    height: scroller.scrollHeight,
    viewport: scroller.clientHeight,
  });
  scroller.scrollTo({ top: target, behavior: 'smooth' });
  return { atTop, atBottom };
}

/**
 * Whether the passage is inside a scrollable box the app did not mark. The AI cannot scroll such a box, so
 * the user may never see the passage.
 */
export function hiddenInUnmarkedBox(range: Range): boolean {
  const { top, bottom } = range.getBoundingClientRect();
  for (let box = range.startContainer.parentElement; box && box !== document.body; box = box.parentElement) {
    if (box.hasAttribute(SCROLL_ATTRIBUTE) || box.scrollHeight <= box.clientHeight) continue;
    if (!/auto|scroll|hidden|clip/.test(getComputedStyle(box).overflowY)) continue;
    const view = box.getBoundingClientRect();
    if (top < view.top || bottom > view.bottom) return true;
  }
  return false;
}

/**
 * Brings a passage to the centre of the view if it is not visible, scrolling only the marked boxes that
 * contain it (innermost first) and the page. Returns whether anything moved.
 */
export function bringIntoView(range: Range): boolean {
  const rect = range.getBoundingClientRect();
  let top = rect.top;
  let scrolled = false;

  const marked = `[${SCROLL_ATTRIBUTE}]`;
  for (let box = range.startContainer.parentElement?.closest<HTMLElement>(marked); box; ) {
    const view = box.getBoundingClientRect();
    if (top < view.top || top + rect.height > view.bottom) {
      const from = box.scrollTop;
      const target = clamp(from + top - view.top - box.clientHeight / 2 + rect.height / 2, box.scrollHeight - box.clientHeight);
      box.scrollTo({ top: target, behavior: 'smooth' });
      top -= target - from;
      scrolled ||= target !== from;
    }
    box = box.parentElement?.closest<HTMLElement>(marked);
  }

  if (top < 0 || top + rect.height > window.innerHeight) {
    const page = document.scrollingElement ?? document.documentElement;
    const target = clamp(page.scrollTop + top - window.innerHeight / 2 + rect.height / 2, page.scrollHeight - page.clientHeight);
    window.scrollTo({ top: target, behavior: 'smooth' });
    scrolled ||= target !== page.scrollTop;
  }
  return scrolled;
}

const clamp = (value: number, max: number) => Math.round(Math.min(Math.max(0, max), Math.max(0, value)));
