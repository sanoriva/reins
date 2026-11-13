import { ActionDefinition } from '@reins-ai/contract';
import { z } from 'zod';

import type { ProvidedContent } from './content.js';

/** What an action knows about the page when it runs. */
export interface ActionContext {
  route: string;
  title: string;
  page: number;
  actions: string[];
  content: ProvidedContent | undefined;
  confirming?: boolean;
  panels?: { key: string; params: Record<string, unknown> }[];
}

/**
 * Blocks text search and reading while a confirmation code is on screen; otherwise the AI could find the code
 * by trying highlight { text: '0000' }, '0001'…
 */
export function assertNotConfirming({ confirming }: ActionContext): void {
  if (confirming) {
    throw new ActionError(
      'NOT_AVAILABLE',
      'A submission is waiting for its confirmation code: ask the user for the code and send it with confirm before reading the screen',
    );
  }
}

export interface AgentAction<P = unknown> {
  definition: ActionDefinition;
  params: z.ZodType<P, any, any>;
  run(params: P, context: ActionContext): unknown;
}

/**
 * An error with an action-specific code, returned to the AI as is.
 *
 * @example
 * if (!found) throw new ActionError('CENTER_NOT_FOUND', 'That centre is not in the results');
 */
export class ActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly attemptsLeft?: number,
  ) {
    super(message);
  }
}

/**
 * Throws when a parameter has no description: it is all the AI reads to know what to send, so this fails at
 * definition time rather than at call time.
 */
export function requireDescriptions(schema: { properties?: unknown }, where: string): void {
  const properties = (schema.properties ?? {}) as Record<string, { description?: string }>;
  for (const [name, property] of Object.entries(properties)) {
    if (!property.description?.trim()) {
      throw new Error(`Parameter "${name}" ${where} has no description: add .describe('…')`);
    }
  }
}

export interface ActionSpec<S extends z.ZodObject> {
  name: string;
  description: string;
  params: S;
  scope?: 'general' | 'page';
  effect?: 'none' | 'confirm';
  run(params: z.infer<S>, context: ActionContext): unknown;
}

/**
 * Defines an action for the AI. The JSON Schema it sees comes from the zod parameters as the AI sends them,
 * so a parameter with a default value is optional. Every parameter needs a description.
 *
 * @example
 * const sortAppointments = defineAction({
 *   name: 'sort_appointments',
 *   description: 'Sorts the upcoming appointments.',
 *   params: z.object({ by: z.enum(['date', 'specialty']).describe('Sort order') }),
 *   run: ({ by }) => store.sortBy(by),
 * });
 */
export function defineAction<S extends z.ZodObject>(spec: ActionSpec<S>): AgentAction<z.infer<S>> {
  const { $schema: _, ...inputSchema } = z.toJSONSchema(spec.params, { io: 'input' });
  requireDescriptions(inputSchema, `of action "${spec.name}"`);
  return {
    definition: ActionDefinition.parse({
      name: spec.name,
      description: spec.description,
      inputSchema,
      scope: spec.scope ?? 'page',
      effect: spec.effect ?? 'none',
    }),
    params: spec.params,
    run: spec.run,
  };
}
