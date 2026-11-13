import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { provideAgent } from '@reins-ai/angular';

import { routes } from './app.routes';
import { authInterceptor, provideSession, SessionStore } from './core/auth';
import { provideAppointments } from './domains/appointments';
import { provideAssistant } from './domains/assistant';
import { provideCenters } from './domains/centers';
import { provideHistory } from './domains/history';
import { provideNotices } from './domains/home';
import { provideMedication } from './domains/medication';
import { provideReports } from './domains/reports';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation(), withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideSession(),
    provideAppointments(),
    provideCenters(),
    provideHistory(),
    provideNotices(),
    provideMedication(),
    provideReports(),
    provideAgent(),
    provideAssistant(),
    provideAppInitializer(() => inject(SessionStore).restore()),
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    }),
  ],
};
