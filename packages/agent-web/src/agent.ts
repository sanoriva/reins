import type { PageEvent } from '@reins-ai/contract';
import type { z } from 'zod';

import type { ActionContext, AgentAction } from './action.js';
import { confirmAction } from './actions/confirm.js';
import { getState } from './actions/get-state.js';
import { clearHighlight, highlight } from './actions/highlight.js';
import { type Navigation, navigateAction } from './actions/navigate.js';
import { readContentAction } from './actions/read-content.js';
import { scroll } from './actions/scroll.js';
import { Channel, type ChannelState, type WebSocketLike } from './channel.js';
import { Confirmation, type ConfirmationState } from './confirmation.js';
import type { ContentReader, ProvidedContent } from './content.js';
import { dispatch } from './dispatcher.js';
import { formActions, type FormSpec, withConfirmation } from './forms.js';
import { createPanels, type PanelsOptions } from './panels.js';

export const DEFAULT_BRIDGE_URL = 'ws://127.0.0.1:7420/page';

const TOKEN_KEY = 'sanoriva-agent.token';
const TAB_KEY = 'sanoriva-agent.tab';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface AgentOptions {
  url?: string;
  actions?: AgentAction[];
  storage?: { local: StorageLike; session: StorageLike };
  createSocket?: (url: string) => WebSocketLike;
  navigation?: Navigation;
  panels?: PanelsOptions;
}

/**
 * Creates the page side of the agent: the connection to the local bridge, the order pipeline, the general actions and
 * the screen counter. It renders nothing; the app decides how to show the connection state, the pairing code and the
 * confirmation code.
 *
 * A pending submission waits for its code, which the app shows and which never leaves the page. `read_content` reads
 * the last content offered: with panels, that of the last opened panel. On every (re)connection the bridge gets the
 * current catalog, without bumping the screen counter, and the content notice if there is content. The browser
 * `WebSocket` is used as `WebSocketLike`, which it satisfies although its event types hide that from TypeScript.
 * @example
 * const agent = createAgent({ navigation: { routes, go: (url) => router.navigate(url) } });
 * agent.onState((state) => {
 *   if (state.status === 'pairing') showPairingCode(state.code);
 * });
 * agent.start();
 */
export function createAgent(options: AgentOptions = {}) {
  const local = options.storage?.local ?? localStorage;
  const session = options.storage?.session ?? sessionStorage;

  const confirmationListeners = new Set<(state: ConfirmationState) => void>();
  const confirmation = new Confirmation((state) => confirmationListeners.forEach((listener) => listener(state)));

  const fixed = new Map<string, AgentAction>();
  const screen = new Map<string, AgentAction>();
  const navigate = options.navigation?.routes.length ? [navigateAction(options.navigation)] : [];
  const panels = options.panels ? createPanels(options.panels) : undefined;
  const general = [getState, readContentAction, highlight, scroll, ...navigate, ...(panels?.actions ?? []), confirmAction(confirmation)];
  const appActions = (options.actions ?? []).map((action) => withConfirmation(action as AgentAction, confirmation));
  for (const action of [...general, ...appActions] as AgentAction[]) {
    if (fixed.has(action.definition.name)) throw new Error(`Duplicate action: ${action.definition.name}`);
    fixed.set(action.definition.name, action);
  }
  const actions = () => new Map([...fixed, ...screen]);

  let tabId = session.getItem(TAB_KEY);
  if (!tabId) {
    tabId = crypto.randomUUID();
    session.setItem(TAB_KEY, tabId);
  }

  let page = 0;
  let route = '';
  let title = '';
  const contents: ProvidedContent[] = [];
  const content = () => contents.at(-1);
  let catalogPending = false;
  const listeners = new Set<(state: ChannelState) => void>();

  const context = (): ActionContext => ({
    route,
    title,
    page,
    actions: [...actions().keys()],
    content: content(),
    confirming: confirmation.state.status === 'pending',
    ...(panels ? { panels: panels.current } : {}),
  });
  const contentAvailable = (): PageEvent | undefined => {
    const current = content();
    return current && { event: 'content.available', data: { type: current.type, title } };
  };
  const pageChanged = (): PageEvent => ({
    event: 'page.changed',
    data: { route, title, page, actions: [...actions().values()].map((action) => action.definition) },
  });
  /**
   * Re-sends the catalog after the screen's actions change, with the same counter. Like the content notice,
   * it goes out on the next tick (after page.changed) and at most once per tick.
   */
  const catalogChanged = () => {
    if (catalogPending) return;
    catalogPending = true;
    setTimeout(() => {
      catalogPending = false;
      channel.send(pageChanged());
    });
  };

  const channel: Channel = new Channel({
    url: options.url ?? DEFAULT_BRIDGE_URL,
    tabId,
    token: {
      get: () => local.getItem(TOKEN_KEY),
      set: (token) => local.setItem(TOKEN_KEY, token),
      clear: () => local.removeItem(TOKEN_KEY),
    },
    createSocket: options.createSocket ?? ((url) => new WebSocket(url) as unknown as WebSocketLike),
    onState: (state) => listeners.forEach((listener) => listener(state)),
    onReady: () => {
      channel.send(pageChanged());
      const available = contentAvailable();
      if (available) channel.send(available);
    },
    onOrder: (order) => void dispatch(order, actions(), context()).then((response) => channel.send(response)),
  });

  const provideActions = (provided: AgentAction[]): (() => void) => {
    const list = provided.map((action) => withConfirmation(action, confirmation));
    for (const action of list) {
      const { name } = action.definition;
      if (fixed.has(name) || screen.has(name)) throw new Error(`Duplicate action: ${name}`);
    }
    for (const action of list) screen.set(action.definition.name, action);
    catalogChanged();
    return () => {
      for (const action of list) {
        if (screen.get(action.definition.name) === action) screen.delete(action.definition.name);
      }
      catalogChanged();
    };
  };

  return {
    start: () => channel.start(),
    stop: () => channel.stop(),
    get state(): ChannelState {
      return channel.state;
    },
    /**
     * Calls `listener` with the current connection state and on every change. Returns an unsubscribe
     * function.
     */
    onState(listener: (state: ChannelState) => void): () => void {
      listeners.add(listener);
      listener(channel.state);
      return () => listeners.delete(listener);
    },
    /**
     * Offers the current screen's content to the AI (`read_content`). `type` is defined by the app; `read` returns the
     * requested part. Returns a function that withdraws it, to call when the screen is destroyed. The new screen is
     * created before navigation ends (`setPage`), so the content notice goes out on the next tick, after
     * `page.changed` and with the final title; nothing is sent if the content was withdrawn meanwhile.
     * @example
     * const withdraw = agent.provideContent('recipe', () => ({ data: { name: 'Tortilla', ingredients: ['eggs', 'potatoes'] } }));
     */
    provideContent(type: string, read: ContentReader): () => void {
      const provided = { type, read };
      contents.push(provided);
      setTimeout(() => {
        if (content() === provided) channel.send(contentAvailable()!);
      });
      return () => {
        const index = contents.indexOf(provided);
        if (index >= 0) contents.splice(index, 1);
      };
    },
    /**
     * Gives the AI the current screen's own actions. Returns a function that withdraws them. Reusing a name
     * that already exists is an error.
     */
    provideActions,
    /**
     * Offers a form: the AI fills it with what the user dictates (`fill_<name>`) and requests its submission
     * (`submit_<name>`), which only happens after the user says the confirmation code. Returns a function
     * that withdraws it.
     */
    provideForm<S extends z.ZodObject>(spec: FormSpec<S>): () => void {
      const remove = provideActions(formActions(spec as unknown as FormSpec, confirmation));
      return () => {
        remove();
        const state = confirmation.state;
        if (state.status === 'pending' && state.form === spec.name) confirmation.cancel();
      };
    },
    /** Calls `listener` with the confirmation state and on every change, so the app can show the code. */
    onConfirmation(listener: (state: ConfirmationState) => void): () => void {
      confirmationListeners.add(listener);
      listener(confirmation.state);
      return () => confirmationListeners.delete(listener);
    },
    /**
     * The page panels, when `panels` is passed in the options. The app renders `current`, listens with
     * `onChange` and calls `sync` when the URL changes elsewhere (e.g. the browser back button).
     */
    panels,
    /**
     * Tells the agent the app changed screen: bumps the counter, clears the highlight, cancels any pending
     * confirmation and sends page.changed.
     */
    setPage(next: { route: string; title: string }) {
      route = next.route;
      title = next.title;
      page += 1;
      clearHighlight();
      confirmation.cancel();
      channel.send(pageChanged());
    },
  };
}

export type Agent = ReturnType<typeof createAgent>;
