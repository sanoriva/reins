import { findText } from './text-search.js';

/** A passage found on screen: its Range and where to continue searching for the next occurrence. */
export interface PageMatch {
  range: Range;
  next: number;
}

/** Finds a passage in the text the user sees and returns it as a browser Range. */
export function findInPage(text: string, from = 0): PageMatch | undefined {
  const nodes = visibleTextNodes();
  const match = findText(
    nodes.map((node) => node.data),
    text,
    from,
  );
  if (!match) return undefined;
  const range = document.createRange();
  range.setStart(nodes[match.start.piece]!, match.start.offset);
  range.setEnd(nodes[match.end.piece]!, match.end.offset);
  return { range, next: match.next };
}

/** What `looksVisible` needs from an element, so it can be checked without a browser. */
export type VisibleCandidate = Pick<Element, 'checkVisibility' | 'getBoundingClientRect'>;

/**
 * Whether the user can see an element's text: it is rendered and not transparent (`display`, `visibility`, `opacity`),
 * it is bigger than 1 px each way (so zero-size boxes, `font-size: 0` and the visually-hidden `sr-only` pattern are
 * left out), and it is not placed entirely before the start of the page. Text the same colour as its background cannot
 * be told apart reliably and is not filtered.
 */
export function looksVisible(element: VisibleCandidate, scroll: { x: number; y: number }): boolean {
  if (!element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) return false;
  const box = element.getBoundingClientRect();
  if (box.width <= 1 || box.height <= 1) return false;
  return box.right + scroll.x > 0 && box.bottom + scroll.y > 0;
}

/**
 * The text nodes the user sees inside `root` (the whole page by default), in document order: no scripts, styles, icons
 * (aria-hidden) or text `looksVisible` rejects. Whitespace-only nodes are kept: they separate words across tags
 * (<b>a</b> <i>b</i>). Each element is measured once per call.
 */
export function visibleTextNodes(root: Node = document.body): Text[] {
  const scroll = { x: window.scrollX, y: window.scrollY };
  const seen = new Map<Element, boolean>();
  const visible = (element: Element) => {
    if (!seen.has(element)) seen.set(element, looksVisible(element, scroll));
    return seen.get(element)!;
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('script, style, noscript, template, [aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
      return visible(parent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}
