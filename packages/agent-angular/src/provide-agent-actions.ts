import { DestroyRef, inject } from '@angular/core';
import type { AgentAction } from '@reins-ai/web';

import { AgentService } from './agent.service';

/**
 * Gives the AI this screen's own actions while the component exists. Call it in the component constructor;
 * the actions are withdrawn when the component is destroyed.
 *
 * @example
 * constructor() {
 *   provideAgentActions([
 *     defineAction({
 *       name: 'sort_appointments',
 *       description: 'Sorts the upcoming appointments.',
 *       params: z.object({ by: z.enum(['date', 'specialty']).describe('Sort order') }),
 *       run: ({ by }) => this.sortBy.set(by),
 *     }),
 *   ]);
 * }
 */
export function provideAgentActions(actions: AgentAction[]): void {
  const { agent } = inject(AgentService);
  inject(DestroyRef).onDestroy(agent.provideActions(actions));
}
