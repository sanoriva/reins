import { z } from 'zod';

/**
 * An action the page exposes to the AI. Same shape as an MCP tool, plus `scope` (`general` actions exist on
 * every page, `page` actions belong to the current screen) and `effect` (`confirm` actions only run after the
 * user says the confirmation code shown on screen).
 *
 * @example
 * const sort: ActionDefinition = {
 *   name: 'sort_appointments',
 *   description: 'Sorts the upcoming appointments.',
 *   inputSchema: { type: 'object', properties: { by: { type: 'string', enum: ['date', 'specialty'] } } },
 *   scope: 'page',
 *   effect: 'none',
 * };
 */
export const ActionDefinition = z.object({
  name: z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/),
  description: z.string().min(1),
  inputSchema: z.looseObject({ type: z.literal('object') }),
  scope: z.enum(['general', 'page']),
  effect: z.enum(['none', 'confirm']),
});
export type ActionDefinition = z.infer<typeof ActionDefinition>;
