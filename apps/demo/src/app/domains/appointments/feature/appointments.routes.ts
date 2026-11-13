import type { Routes } from '@angular/router';
import type { AgentRouteData } from '@reins-ai/angular';
import { z } from 'zod';

import { authGuard } from '../../../core/auth';
import { BOOKING_HELP } from '../booking/feature/booking.help';
import { APPOINTMENTS_HELP } from './appointments.help';

export const APPOINTMENTS_ROUTES: Routes = [
  {
    path: 'citas',
    loadComponent: () => import('./appointments.component').then((m) => m.AppointmentsComponent),
    title: 'Mis citas',
    canActivate: [authGuard],
    data: {
      help: APPOINTMENTS_HELP,
      agent: { key: 'appointments', description: 'Mis citas: las próximas y las anteriores; aquí también se anula una cita' } satisfies AgentRouteData,
    },
  },
  {
    path: 'citas/nueva',
    loadComponent: () => import('../booking').then((m) => m.BookingComponent),
    title: 'Pedir cita',
    canActivate: [authGuard],
    data: {
      help: BOOKING_HELP,
      agent: {
        key: 'book',
        description: 'Pedir cita: se elige la especialidad y luego un hueco libre',
        params: z.object({
          especialidad: z.string().min(1).describe('La especialidad, tal como la ves con read_content en esta pantalla (p. ej. su slug)').optional(),
        }),
      } satisfies AgentRouteData,
    },
  },
];
