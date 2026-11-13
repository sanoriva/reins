import { z } from 'zod';

import { type AgentAction, defineAction } from '../action.js';
import type { Confirmation } from '../confirmation.js';

export function confirmAction(confirmation: Confirmation): AgentAction {
  return defineAction({
    name: 'confirm',
    description:
      'Sends the confirmation code the user reads out loud (shown on screen after NEEDS_CONFIRMATION). If it matches, the page submits. Never make it up: ask the user for it.',
    scope: 'general',
    params: z.object({ code: z.string().min(1).describe('The 4-digit code the user said') }),
    run: async ({ code }) => ({ sent: true, result: (await confirmation.confirm(code)) ?? null }),
  });
}
