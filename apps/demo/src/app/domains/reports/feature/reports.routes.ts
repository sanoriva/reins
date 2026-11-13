import type { Routes } from '@angular/router';
import type { AgentRouteData } from '@reins-ai/angular';
import { z } from 'zod';

import { authGuard } from '../../../core/auth';
import { READING_HELP } from '../reading/feature/reading.help';
import { REPORTS_HELP } from './reports.help';

export const REPORTS_ROUTES: Routes = [
  {
    path: 'informes',
    loadComponent: () => import('./reports.component').then((m) => m.ReportsComponent),
    title: 'Mis informes',
    canActivate: [authGuard],
    data: {
      help: REPORTS_HELP,
      agent: { key: 'reports', description: 'La lista de informes médicos y análisis de la paciente' } satisfies AgentRouteData,
    },
  },
  {
    path: 'informes/:id',
    loadComponent: () => import('../reading').then((m) => m.ReadingComponent),
    title: 'Informe',
    canActivate: [authGuard],
    data: {
      help: READING_HELP,
      agent: {
        key: 'report',
        description: 'Un informe médico entero, para leerlo',
        params: z.object({ id: z.string().min(1).describe('El id del informe, tal como lo ves con read_content en Mis informes') }),
      } satisfies AgentRouteData,
    },
  },
];
