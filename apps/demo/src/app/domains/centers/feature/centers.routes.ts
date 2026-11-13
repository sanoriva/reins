import type { Routes } from '@angular/router';
import type { AgentRouteData } from '@reins-ai/angular';
import { z } from 'zod';

import { CENTERS_HELP } from './centers.help';

export const CENTERS_ROUTES: Routes = [
  {
    path: 'centros',
    loadComponent: () => import('./centers.component').then((m) => m.CentersComponent),
    title: 'Centros de salud',
    data: {
      help: CENTERS_HELP,
      agent: {
        key: 'centers',
        description: 'Buscar centros de salud, hospitales y centros de especialidades, con sus horarios',
        params: z.object({ q: z.string().min(1).describe('Localidad, nombre del centro o servicio que hay que buscar').optional() }),
      } satisfies AgentRouteData,
    },
  },
];
