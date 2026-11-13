import type { Routes } from '@angular/router';
import type { AgentRouteData } from '@reins-ai/angular';

import { authGuard } from '../../../core/auth';
import { MEDICATION_HELP } from './medication.help';

export const MEDICATION_ROUTES: Routes = [
  {
    path: 'medicacion',
    loadComponent: () => import('./medication.component').then((m) => m.MedicationComponent),
    title: 'Medicación',
    canActivate: [authGuard],
    data: {
      help: MEDICATION_HELP,
      agent: { key: 'medication', description: 'Medicación: qué tomar hoy, los tratamientos y pedir la renovación de una receta' } satisfies AgentRouteData,
    },
  },
];
