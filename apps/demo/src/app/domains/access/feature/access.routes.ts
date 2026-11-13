import type { Routes } from '@angular/router';

import { ACCESS_HELP } from './access.help';

/** No `data.agent`: the AI cannot sign anyone in. */
export const ACCESS_ROUTES: Routes = [
  { path: 'entrar', loadComponent: () => import('./login.component').then((m) => m.LoginComponent), title: 'Entrar', data: { help: ACCESS_HELP } },
];
