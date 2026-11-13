import type { AgentPanelSpec } from '@reins-ai/angular';
import { z } from 'zod';

/** The appointment screens that also open as panels on the assistant page. They load when opened. */
export const APPOINTMENTS_PANELS: AgentPanelSpec[] = [
  {
    key: 'appointments',
    title: 'Mis citas',
    description: 'Las próximas citas y las anteriores; aquí también se anula una cita',
    load: () => import('./appointments.component').then((m) => m.AppointmentsComponent),
  },
  {
    key: 'book',
    title: 'Pedir cita',
    description: 'Pedir una cita: se elige la especialidad y luego un hueco libre',
    params: z.object({ especialidad: z.string().min(1).describe('El slug de la especialidad, tal como lo ves con read_content (p. ej. enfermeria)').optional() }),
    load: () => import('../booking').then((m) => m.BookingComponent),
  },
];
