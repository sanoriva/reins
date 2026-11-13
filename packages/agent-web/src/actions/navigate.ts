import { ProtocolErrorCode } from '@reins-ai/contract';
import { z } from 'zod';

import { ActionError, type AgentAction, defineAction, requireDescriptions } from '../action.js';

/** A screen the AI can open. The app defines it; the AI only knows its key, never a URL. */
export interface AgentRoute {
  key: string;
  path: string;
  title?: string;
  description: string;
  params?: z.ZodObject;
}

export interface Navigation {
  routes: AgentRoute[];
  /** Navigates to an app URL. Return `false` when the app refuses, for example because of a guard. */
  go(url: string): void | boolean | Promise<void | boolean>;
}

/**
 * Builds a screen URL: path parameters fill the `:params` and the rest go to the query string. A path parameter
 * cannot be empty, "." or "..": the browser would resolve the URL to another path, one the app may not offer.
 *
 * @example
 * buildUrl('/reports/:id', { id: 'blood-test', from: 'home' }); // '/reports/blood-test?from=home'
 */
export function buildUrl(path: string, params: Record<string, unknown> = {}): string {
  const rest = new Map(Object.entries(params).filter(([, value]) => value !== undefined && value !== null));
  const filled = path.replace(/:(\w+)/g, (_, name: string) => {
    if (!rest.has(name)) throw new ActionError(ProtocolErrorCode.INVALID_PARAMS, `Missing parameter ${name}`);
    const raw = String(rest.get(name));
    if (raw === '' || raw === '.' || raw === '..') {
      throw new ActionError(ProtocolErrorCode.INVALID_PARAMS, `Parameter ${name} cannot be empty, "." or ".."`);
    }
    const value = encodeURIComponent(raw);
    rest.delete(name);
    return value;
  });
  const query = new URLSearchParams([...rest].map(([name, value]) => [name, String(value)])).toString();
  return query ? `${filled}?${query}` : filled;
}

/** The general `navigate` action for the screens the app defines. */
export function navigateAction({ routes, go }: Navigation): AgentAction {
  const keys = routes.map((route) => route.key);
  if (keys.length === 0) throw new Error('navigation needs at least one screen');
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate screen keys');
  routes.forEach(checkRoute);

  return defineAction({
    name: 'navigate',
    description: [
      'Opens an app screen by its key (to), with its parameters (params) if it has any. Screens:',
      ...routes.map(describe),
    ].join('\n'),
    scope: 'general',
    params: z.object({
      to: z.enum(keys as [string, ...string[]]).describe('Screen key'),
      params: z.record(z.string(), z.unknown()).optional().describe('Parameters of that screen'),
    }),
    run: async ({ to, params }) => {
      const route = routes.find((r) => r.key === to)!;
      const parsed = (route.params ?? z.object({})).safeParse(params ?? {});
      if (!parsed.success) {
        throw new ActionError(ProtocolErrorCode.INVALID_PARAMS, `Parameters of ${to}: ${z.prettifyError(parsed.error)}`);
      }
      const url = buildUrl(route.path, parsed.data as Record<string, unknown>);
      if ((await go(url)) === false) {
        throw new ActionError(ProtocolErrorCode.NOT_AVAILABLE, 'The app did not allow opening that screen');
      }
      return { route: url };
    },
  });
}

/** Validates a screen at startup: every path `:param` must be declared in `params`, with a description. */
function checkRoute({ key, path, params }: AgentRoute): void {
  const schema: { properties?: unknown } = params ? z.toJSONSchema(params, { io: 'input' }) : {};
  const properties = (schema.properties ?? {}) as Record<string, unknown>;
  for (const [, name] of path.matchAll(/:(\w+)/g)) {
    if (!properties[name!]) throw new Error(`Screen "${key}" uses :${name} in its path, but it is not in params`);
  }
  requireDescriptions(schema, `of screen "${key}"`);
}

function describe(route: AgentRoute): string {
  const title = route.title ? ` (${route.title})` : '';
  if (!route.params) return `- ${route.key}${title}: ${route.description}. No parameters.`;
  const { $schema: _, ...schema } = z.toJSONSchema(route.params, { io: 'input' });
  return `- ${route.key}${title}: ${route.description}. Parameters: ${JSON.stringify(schema)}`;
}
