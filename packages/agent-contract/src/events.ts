import { z } from 'zod';

import { ActionDefinition } from './catalog.js';
import { PageCounter } from './orders.js';

/** Sent when the screen changes, with the new route, the new screen counter and the actions now available. */
export const PageChanged = z.object({
  event: z.literal('page.changed'),
  data: z.object({
    route: z.string(),
    title: z.string(),
    page: PageCounter,
    actions: z.array(ActionDefinition),
  }),
});

/** Sent when the current screen starts offering content to read. */
export const ContentAvailable = z.object({
  event: z.literal('content.available'),
  data: z.object({
    type: z.string().min(1),
    title: z.string(),
  }),
});

/** Sent when the tab becomes active, goes to the background or is closed. */
export const TabState = z.object({
  event: z.literal('tab.state'),
  data: z.object({
    state: z.enum(['active', 'background', 'closed']),
  }),
});

/**
 * Notifications from the page. Unlike orders they carry no id and expect no response; the bridge queues them
 * and hands them to the AI with its next result.
 */
export const PageEvent = z.discriminatedUnion('event', [PageChanged, ContentAvailable, TabState]);
export type PageEvent = z.infer<typeof PageEvent>;
export type PageEventName = PageEvent['event'];
