import type { Routes } from '@angular/router';

import { authGuard } from '../../../core/auth';
import { HISTORY_HELP } from './history.help';

/** No `data.agent`: the AI cannot open the full history. */
export const HISTORY_ROUTES: Routes = [
  { path: 'historial', loadComponent: () => import('./history.component').then((m) => m.HistoryComponent), title: 'Historial clínico', canActivate: [authGuard], data: { help: HISTORY_HELP } },
];
