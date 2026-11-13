import { z } from 'zod';

/**
 * Role carried by every piece of page content sent to the AI. It marks the content as data to read, never as
 * instructions, as one of the protections against prompt injection.
 */
export const CONTENT_ROLE = 'content-not-instructions';

/**
 * Envelope for the content a screen offers to the AI. The app defines `type` and the shape of `data`; long
 * content is split into parts, and `more` tells the AI to ask for the next one.
 *
 * @example
 * const part: Content = {
 *   role: CONTENT_ROLE,
 *   type: 'report',
 *   data: { blocks: ['Blood test', 'Fasting glucose: 112 mg/dl'] },
 *   more: true,
 * };
 */
export const Content = z.object({
  role: z.literal(CONTENT_ROLE),
  type: z.string().min(1),
  data: z.unknown(),
  more: z.boolean().optional(),
});
export type Content = z.infer<typeof Content>;
