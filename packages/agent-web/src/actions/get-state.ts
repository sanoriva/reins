import { z } from 'zod';

import { defineAction } from '../action.js';
import { scrollAreas } from '../scroll-areas.js';

export const getState = defineAction({
  name: 'get_state',
  description:
    'Tells which screen the page is on (route and title), its screen counter, the available actions, the type of content that can be read (read_content), the scrollable boxes (scrollAreas, for scroll in) and, if the page has panels, which ones are open.',
  scope: 'general',
  params: z.object({}),
  run: (_params, { route, title, page, actions, content, panels }) => ({
    route,
    title,
    page,
    actions,
    content: content?.type ?? null,
    scrollAreas: [...scrollAreas().keys()],
    ...(panels ? { panels } : {}),
  }),
});
