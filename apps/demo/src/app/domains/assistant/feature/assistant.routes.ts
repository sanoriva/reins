import type { Routes } from '@angular/router';
import type { AgentRouteData } from '@reins-ai/angular';

import { authGuard } from '../../../core/auth';
import { ASSISTANT_HELP } from './assistant.help';

export const ASSISTANT_ROUTES: Routes = [
  {
    path: 'asistente',
    loadComponent: () => import('./assistant.component').then((m) => m.AssistantComponent),
    title: 'Asistente',
    canActivate: [authGuard],
    data: {
      help: ASSISTANT_HELP,
      agent: {
        key: 'assistant',
        description: 'Página del asistente: una página limpia donde se enseña lo que pide el usuario como paneles (open_panel)',
      } satisfies AgentRouteData,
    },
  },
];
