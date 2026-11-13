import { type EnvironmentProviders, inject, Injectable, InjectionToken, makeEnvironmentProviders, type Signal, signal, type Type } from '@angular/core';
import type { Router } from '@angular/router';
import type { AgentPanel, OpenPanel, PanelsOptions } from '@reins-ai/web';

import { AgentService } from './agent.service';

/**
 * A panel in Angular: the agent-web panel (key, description, zod parameters) plus the component that renders
 * it, given directly or loaded on demand like `loadComponent`. The parameters reach the component as inputs.
 */
export interface AgentPanelSpec extends AgentPanel {
  component?: Type<unknown>;
  load?: () => Promise<Type<unknown> | { default: Type<unknown> }>;
}

/**
 * `path` is the page that shows the panels: when the AI opens one from another screen, the app navigates there.
 * `param` is the query parameter that stores the open panels (`panels` by default).
 */
export interface AgentPanelsConfig {
  path: string;
  panels: AgentPanelSpec[];
  param?: string;
}

/** An open panel, ready to render with `NgComponentOutlet`. `component` is undefined while it loads. */
export interface AgentPanelView {
  key: string;
  title?: string;
  params: Record<string, unknown>;
  component: Type<unknown> | undefined;
}

export const AGENT_PANELS = new InjectionToken<AgentPanelsConfig>('AGENT_PANELS');

/**
 * Panels of a page that the AI opens and closes (`open_panel`, `close_panel`). The library renders nothing: the
 * app shows them with `AgentPanels`.
 *
 * @example
 * provideAgentPanels({
 *   path: '/assistant',
 *   panels: [
 *     { key: 'appointments', description: 'Upcoming appointments', load: () => import('./appointments.component') },
 *   ],
 * });
 */
export function provideAgentPanels(config: AgentPanelsConfig): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: AGENT_PANELS, useValue: config }, AgentPanels]);
}

/**
 * Stores the panels in the router URL: on `config.path`, in the `config.param` query parameter. Navigating bumps the
 * screen counter (provideAgent reports every navigation) and reads the panels again.
 */
export function routerPanels(router: Router, { path, panels, param = 'panels' }: AgentPanelsConfig): PanelsOptions {
  return {
    panels: panels.map(({ key, title, description, params }) => ({ key, description, ...(title ? { title } : {}), ...(params ? { params } : {}) })),
    read: () => {
      const tree = router.parseUrl(router.url);
      const onPage = router.url.split(/[?#]/)[0] === path;
      return onPage ? String(tree.queryParams[param] ?? '') : '';
    },
    write: (value) => router.navigate([path], { queryParams: { [param]: value || null } }).then((done) => done !== false),
  };
}

/**
 * The open panels as a signal, with their components loaded, and how to open and close them from the app.
 *
 * @example
 * @for (panel of panels.current(); track panel.key) {
 *   <ng-container *ngComponentOutlet="panel.component; inputs: panel.params" />
 * }
 */
@Injectable()
export class AgentPanels {
  private readonly config = inject(AGENT_PANELS);
  private readonly panels = inject(AgentService).agent.panels!;
  private readonly loaded = new Map<string, Type<unknown>>();
  private readonly currentSignal = signal<AgentPanelView[]>([]);

  /** The open panels, oldest first. */
  readonly current: Signal<AgentPanelView[]> = this.currentSignal.asReadonly();

  constructor() {
    this.panels.onChange((open) => {
      this.render(open);
      for (const { key } of open) void this.load(key).then(() => this.render(this.panels.current));
    });
  }

  /** Opens a panel from the app (a button, a link), the same as the AI's `open_panel`. */
  open(key: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.panels.open(key, params);
  }

  close(key: string): Promise<unknown> {
    return this.panels.close(key);
  }

  private render(open: OpenPanel[]): void {
    this.currentSignal.set(
      open.map(({ key, params }) => {
        const spec = this.config.panels.find((p) => p.key === key)!;
        return { key, params, component: spec.component ?? this.loaded.get(key), ...(spec.title ? { title: spec.title } : {}) };
      }),
    );
  }

  private async load(key: string): Promise<void> {
    const spec = this.config.panels.find((p) => p.key === key);
    if (!spec?.load || this.loaded.has(key)) return;
    const loaded = await spec.load();
    this.loaded.set(key, 'default' in loaded ? loaded.default : loaded);
  }
}
