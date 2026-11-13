import { DestroyRef, type EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, type Routes, TitleStrategy } from '@angular/router';
import type { AgentOptions, AgentRoute, Navigation } from '@reins-ai/web';

import { AgentService } from './agent.service';
import { AGENT_PANELS, routerPanels } from './provide-agent-panels';

/**
 * What goes in a route's `data.agent` so the AI can open it with `navigate`. The AI sends the key, never a URL;
 * path `:params` and the rest of `params` (as the query string) come from the zod schema.
 *
 * @example
 * {
 *   path: 'reports/:id',
 *   title: 'Report',
 *   loadComponent: () => import('./report.component'),
 *   data: {
 *     agent: {
 *       key: 'report',
 *       description: 'A medical report',
 *       params: z.object({ id: z.string().describe('Report id') }),
 *     } satisfies AgentRouteData,
 *   },
 * }
 */
export interface AgentRouteData {
  key: string;
  description: string;
  params?: AgentRoute['params'];
}

/**
 * Creates the agent, connects it when the app starts and tells it about every navigation. Routes with `data.agent` are
 * the screens the AI can open; any other route is out of its reach. The tab title is not set yet at NavigationEnd, so
 * it is built from the route. Panels live in the URL: the back button, a link or the AI itself may have changed them.
 * @example
 * bootstrapApplication(App, {
 *   providers: [provideRouter(routes), provideAgent()],
 * });
 */
export function provideAgent(options: AgentOptions = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: AgentService,
      useFactory: () => {
        const router = inject(Router);
        const panels = inject(AGENT_PANELS, { optional: true });
        return new AgentService({ navigation: routerNavigation(router), ...(panels ? { panels: routerPanels(router, panels) } : {}), ...options });
      },
    },
    provideAppInitializer(() => {
      const { agent } = inject(AgentService);
      const router = inject(Router);
      const titleStrategy = inject(TitleStrategy);
      const title = inject(Title);

      const subscription = router.events.subscribe((event) => {
        if (!(event instanceof NavigationEnd)) return;
        const routeTitle = titleStrategy.buildTitle(router.routerState.snapshot) ?? title.getTitle();
        agent.setPage({ route: router.url, title: routeTitle });
        agent.panels?.sync();
      });
      agent.start();

      inject(DestroyRef).onDestroy(() => {
        subscription.unsubscribe();
        agent.stop();
      });
    }),
  ]);
}

/** Routes with `data.agent` (children included), navigated with the router. Without any, there is no `navigate`. */
function routerNavigation(router: Router): Navigation | undefined {
  const routes = agentRoutes(router.config);
  if (routes.length === 0) return undefined;
  return { routes, go: (url) => router.navigateByUrl(url) };
}

function agentRoutes(config: Routes, parent = ''): AgentRoute[] {
  return config.flatMap((route) => {
    const path = [parent, route.path].filter(Boolean).join('/');
    const data = route.data?.['agent'] as AgentRouteData | undefined;
    const own: AgentRoute[] = data
      ? [{ ...data, path: `/${path}`, ...(typeof route.title === 'string' ? { title: route.title } : {}) }]
      : [];
    return [...own, ...agentRoutes(route.children ?? [], path)];
  });
}
