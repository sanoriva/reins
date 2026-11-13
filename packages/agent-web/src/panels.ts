import { ProtocolErrorCode } from '@reins-ai/contract';
import { z } from 'zod';

import { ActionError, type AgentAction, defineAction, requireDescriptions } from './action.js';

/**
 * A panel: a piece of a page (the appointments, a report, a form…) that the AI opens and closes, with several
 * open at once. The app declares it like a screen; the library does not render it.
 */
export interface AgentPanel {
  key: string;
  title?: string;
  description: string;
  params?: z.ZodObject;
}

export interface OpenPanel {
  key: string;
  params: Record<string, unknown>;
}

export interface PanelsOptions {
  panels: AgentPanel[];
  /** Returns the open panels as currently stored in the URL, or '' if none. */
  read(): string;
  /**
   * Stores the open panels in the URL, so they survive reloads and can be shared. Return `false` to refuse.
   */
  write(value: string): void | boolean | Promise<void | boolean>;
}

/**
 * Encodes the open panels for the URL, in a readable form: each panel is its key, followed by its parameters
 * as a query string.
 *
 * @example
 * encodePanels([{ key: 'appointments', params: {} }, { key: 'report', params: { id: 'blood-test' } }]);
 * // 'appointments,report:id=blood-test'
 */
export function encodePanels(open: OpenPanel[]): string {
  return open
    .map(({ key, params }) => {
      const query = new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([name, value]) => [name, String(value)]),
      ).toString();
      return query ? `${key}:${query}` : key;
    })
    .join(',');
}

/** Decodes the panels from the URL, ignoring unknown keys and invalid parameters. */
export function decodePanels(value: string, panels: AgentPanel[]): OpenPanel[] {
  const open: OpenPanel[] = [];
  for (const item of value.split(',').filter(Boolean)) {
    const [key = '', query = ''] = item.split(/:(.*)/s);
    const panel = panels.find((p) => p.key === key);
    if (!panel || open.some((p) => p.key === key)) continue;
    const parsed = (panel.params ?? z.object({})).safeParse(Object.fromEntries(new URLSearchParams(query)));
    if (parsed.success) open.push({ key, params: parsed.data as Record<string, unknown> });
  }
  return open;
}

/**
 * The panels of a page: their state, the `open_panel` and `close_panel` actions for the AI, and change notifications.
 * Usually created through `createAgent({ panels })`. A change is notified once, even when the router already notified
 * it while the URL was being written.
 * @example
 * const panels = createPanels({
 *   panels: [{ key: 'appointments', description: 'Upcoming and past appointments' }],
 *   read: () => new URLSearchParams(location.search).get('panels') ?? '',
 *   write: (value) => history.pushState(null, '', value ? `?panels=${value}` : location.pathname),
 * });
 * panels.onChange((open) => render(open));
 */
export function createPanels({ panels, read, write }: PanelsOptions) {
  const keys = panels.map((panel) => panel.key);
  if (keys.length === 0) throw new Error('panels needs at least one panel');
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate panel keys');
  for (const { key, params } of panels) {
    requireDescriptions(params ? z.toJSONSchema(params, { io: 'input' }) : {}, `of panel "${key}"`);
  }

  let open = decodePanels(read(), panels);
  const listeners = new Set<(open: OpenPanel[]) => void>();
  const notify = () => listeners.forEach((listener) => listener(open));

  const set = async (next: OpenPanel[]) => {
    if ((await write(encodePanels(next))) === false) {
      throw new ActionError(ProtocolErrorCode.NOT_AVAILABLE, 'The app did not allow changing the panels');
    }
    const changed = encodePanels(next) !== encodePanels(open);
    open = next;
    if (changed) notify();
    return open;
  };

  const panelsApi = {
    /** The open panels, oldest first. */
    get current(): OpenPanel[] {
      return open;
    },
    /** Opens a panel, or updates its parameters if it is open, and brings it to the front. */
    async open(key: string, params: Record<string, unknown> = {}): Promise<OpenPanel[]> {
      const panel = panels.find((p) => p.key === key);
      if (!panel) throw new ActionError(ProtocolErrorCode.INVALID_PARAMS, `There is no panel ${key}`);
      const parsed = (panel.params ?? z.object({})).safeParse(params);
      if (!parsed.success) {
        throw new ActionError(ProtocolErrorCode.INVALID_PARAMS, `Parameters of ${key}: ${z.prettifyError(parsed.error)}`);
      }
      return set([...open.filter((p) => p.key !== key), { key, params: parsed.data as Record<string, unknown> }]);
    },
    async close(key: string): Promise<OpenPanel[]> {
      if (!open.some((p) => p.key === key)) throw new ActionError('PANEL_NOT_OPEN', `Panel ${key} is not open`);
      return set(open.filter((p) => p.key !== key));
    },
    /** Reads the URL again after it changed elsewhere (browser back button, a link). */
    sync(): void {
      const next = decodePanels(read(), panels);
      if (encodePanels(next) === encodePanels(open)) return;
      open = next;
      notify();
    },
    /** Calls `listener` with the open panels and on every change. Returns an unsubscribe function. */
    onChange(listener: (open: OpenPanel[]) => void): () => void {
      listeners.add(listener);
      listener(open);
      return () => listeners.delete(listener);
    },
    actions: [] as AgentAction[],
  };

  const summary = () => ({ open: open.map((p) => p.key) });
  panelsApi.actions = [
    defineAction({
      name: 'open_panel',
      description: [
        'Opens a panel on the page, with its parameters (params) if it has any; if it was already open, updates its parameters and brings it to the front. Several can be open at once; read_content reads the last one opened. Panels:',
        ...panels.map(describe),
      ].join('\n'),
      scope: 'general',
      params: z.object({
        panel: z.enum(keys as [string, ...string[]]).describe('Panel key'),
        params: z.record(z.string(), z.unknown()).optional().describe('Parameters of that panel'),
      }),
      run: async ({ panel, params }) => (await panelsApi.open(panel, params ?? {}), summary()),
    }),
    defineAction({
      name: 'close_panel',
      description: 'Closes an open panel of the page (get_state lists them).',
      scope: 'general',
      params: z.object({ panel: z.enum(keys as [string, ...string[]]).describe('Key of the panel to close') }),
      run: async ({ panel }) => (await panelsApi.close(panel), summary()),
    }),
  ];
  return panelsApi;
}

export type Panels = ReturnType<typeof createPanels>;

function describe(panel: AgentPanel): string {
  const title = panel.title ? ` (${panel.title})` : '';
  if (!panel.params) return `- ${panel.key}${title}: ${panel.description}. No parameters.`;
  const { $schema: _, ...schema } = z.toJSONSchema(panel.params, { io: 'input' });
  return `- ${panel.key}${title}: ${panel.description}. Parameters: ${JSON.stringify(schema)}`;
}
