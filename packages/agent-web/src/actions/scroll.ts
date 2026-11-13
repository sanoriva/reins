import { ProtocolErrorCode } from '@reins-ai/contract';
import { z } from 'zod';

import { ActionError, assertNotConfirming, defineAction } from '../action.js';
import { findInPage } from '../page-text.js';
import { bringIntoView, hiddenInUnmarkedBox, scrollAreas, scrollBy } from '../scroll-areas.js';

/** `visible: false` means the text is inside a box the app did not mark, which the AI cannot scroll. */
export const scroll = defineAction({
  name: 'scroll',
  description:
    'Scrolls the page or a scrollable box. to: up/down (one screen), top/bottom (start/end). To scroll a box, pass its name in in; get_state lists the boxes of this screen (scrollAreas). With text, brings that text into view; if it answers visible: false, the text is in an area you cannot scroll and the user cannot see it. Send either to or text.',
  scope: 'general',
  params: z
    .object({
      to: z.enum(['up', 'down', 'top', 'bottom']).optional().describe('Where to scroll'),
      in: z.string().min(1).optional().describe('Box name (scrollAreas from get_state); without it, the page'),
      text: z.string().min(1).optional().describe('Visible text to bring into view'),
    })
    .refine((p) => (p.to === undefined) !== (p.text === undefined), 'Send either to or text')
    .refine((p) => p.in === undefined || p.to !== undefined, 'in only goes with to'),
  run: ({ to, in: name, text }, context) => {
    if (text !== undefined) {
      assertNotConfirming(context);
      const match = findInPage(text);
      if (!match) throw new ActionError('TEXT_NOT_FOUND', 'That text is not on the screen');
      const visible = !hiddenInUnmarkedBox(match.range);
      return { scrolled: bringIntoView(match.range), visible };
    }
    const areas = scrollAreas();
    const area = name === undefined ? undefined : areas.get(name);
    if (name !== undefined && !area) {
      const names = [...areas.keys()];
      throw new ActionError(
        ProtocolErrorCode.NOT_AVAILABLE,
        `There is no box "${name}". ${names.length ? `Boxes on this screen: ${names.join(', ')}` : 'This screen has no boxes'}`,
      );
    }
    return scrollBy(to!, area);
  },
});
