import type { Routes } from '@angular/router';
import type { AgentRouteData } from '@reins-ai/angular';

import { HOME_HELP } from './home.help';

export const HOME_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./home.component').then((m) => m.HomeComponent),
    title: 'Inicio',
    data: {
      help: HOME_HELP,
      agent: { key: 'home', description: 'Inicio: la próxima cita, los avisos y lo que toca tomar hoy' } satisfies AgentRouteData,
    },
  },
];
