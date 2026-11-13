import type { Routes } from '@angular/router';

import { ACCESS_ROUTES } from './domains/access';
import { APPOINTMENTS_ROUTES } from './domains/appointments';
import { ASSISTANT_ROUTES } from './domains/assistant';
import { CENTERS_ROUTES } from './domains/centers';
import { HISTORY_ROUTES } from './domains/history';
import { HOME_ROUTES } from './domains/home';
import { MEDICATION_ROUTES } from './domains/medication';
import { REPORTS_ROUTES } from './domains/reports';

/**
 * The routes of every domain, together. They are plain arrays rather than loadChildren because provideAgent
 * reads data.agent from router.config, which does not include lazily loaded routes yet. Each screen is still
 * lazy loaded.
 */
export const routes: Routes = [
  ...HOME_ROUTES,
  ...ASSISTANT_ROUTES,
  ...CENTERS_ROUTES,
  ...APPOINTMENTS_ROUTES,
  ...REPORTS_ROUTES,
  ...MEDICATION_ROUTES,
  ...HISTORY_ROUTES,
  ...ACCESS_ROUTES,
  { path: '**', redirectTo: '' },
];
