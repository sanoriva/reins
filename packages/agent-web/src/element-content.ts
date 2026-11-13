import { ProtocolErrorCode } from '@reins-ai/contract';

import { ActionError } from './action.js';
import type { ContentReader } from './content.js';
import { visibleTextNodes } from './page-text.js';

/** Elements that start a new block of text. */
const BLOCK = 'p, h1, h2, h3, h4, h5, h6, li, dt, dd, blockquote, pre, figcaption, caption, th, td, div, section, article, header, footer, aside, main';

/** Characters per part: enough to read continuously without overloading the AI. */
export const DEFAULT_PART_SIZE = 3000;

/**
 * Reads the visible text of an already rendered element (CMS HTML, rendered markdown, any template), in
 * blocks and split into parts. Nothing has to be prepared, and it is the same text `highlight` searches.
 *
 * @example
 * const withdraw = agent.provideContent('report', readElement(() => document.querySelector('article')));
 */
export function readElement(
  element: () => Element | null | undefined,
  { partSize = DEFAULT_PART_SIZE }: { partSize?: number } = {},
): ContentReader {
  return (part) => {
    const root = element();
    if (!root) throw new ActionError(ProtocolErrorCode.NOT_AVAILABLE, 'The content is not on the screen yet');
    const parts = splitParts(elementBlocks(root), partSize);
    if (part >= parts.length && part > 0) {
      const count = parts.length === 1 ? 'one part (0)' : `${parts.length} parts (0 to ${parts.length - 1})`;
      throw new ActionError(ProtocolErrorCode.INVALID_PARAMS, `There is only ${count}`);
    }
    return { data: { blocks: parts[part] ?? [] }, more: part < parts.length - 1 };
  };
}

function elementBlocks(root: Element): string[] {
  return joinBlocks(
    visibleTextNodes(root).map((node) => {
      const block = node.parentElement?.closest(BLOCK);
      return { text: node.data, block: block && root.contains(block) ? block : root };
    }),
  );
}

/** Joins the consecutive texts of each block, normalising whitespace. */
export function joinBlocks(pieces: readonly { text: string; block: unknown }[]): string[] {
  const blocks: string[] = [];
  let current: unknown;
  let text = '';
  const flush = () => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean) blocks.push(clean);
    text = '';
  };
  for (const piece of pieces) {
    if (piece.block !== current) {
      flush();
      current = piece.block;
    }
    text += piece.text;
  }
  flush();
  return blocks;
}

/** Groups consecutive blocks into parts of up to `size` characters. A longer block goes alone, whole. */
export function splitParts(blocks: readonly string[], size: number): string[][] {
  const parts: string[][] = [];
  let current: string[] = [];
  let length = 0;
  for (const block of blocks) {
    if (current.length > 0 && length + block.length > size) {
      parts.push(current);
      current = [];
      length = 0;
    }
    current.push(block);
    length += block.length;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}
