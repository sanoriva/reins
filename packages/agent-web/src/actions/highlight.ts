import { ProtocolErrorCode } from '@reins-ai/contract';
import { z } from 'zod';

import { ActionError, assertNotConfirming, defineAction } from '../action.js';
import { findInPage } from '../page-text.js';
import { bringIntoView } from '../scroll-areas.js';

/** Name of the CSS highlight. Style it in the app with `::highlight(sanoriva)`. */
export const HIGHLIGHT_NAME = 'sanoriva';

/** Where the last search stopped, so a repeated passage moves forward as the AI reads. */
let last: { page: number; next: number } | undefined;

export const highlight = defineAction({
  name: 'highlight',
  description:
    'Highlights on screen the passage you are reading out loud and scrolls to it if it is not visible. Copy the text exactly as read_content returned it.',
  scope: 'general',
  params: z.object({ text: z.string().min(1).describe('The passage you are reading') }),
  run: ({ text }, context) => {
    assertNotConfirming(context);
    const { page } = context;
    if (typeof CSS === 'undefined' || !CSS.highlights) {
      throw new ActionError(ProtocolErrorCode.NOT_AVAILABLE, 'This browser cannot highlight text');
    }
    const match = findInPage(text, last?.page === page ? last.next : 0);
    if (!match) throw new ActionError('TEXT_NOT_FOUND', 'That text is not on the screen');
    last = { page, next: match.next };
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(match.range));
    return { scrolled: bringIntoView(match.range) };
  },
});

/** Clears the highlight. Called on every screen change. */
export function clearHighlight(): void {
  last = undefined;
  if (typeof CSS !== 'undefined' && CSS.highlights) CSS.highlights.delete(HIGHLIGHT_NAME);
}
