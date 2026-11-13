import type { AgentPanelSpec } from '@reins-ai/angular';
import { z } from 'zod';

/** The report screens that also open as panels on the assistant page. They load when opened. */
export const REPORTS_PANELS: AgentPanelSpec[] = [
  {
    key: 'reports',
    title: 'Mis informes',
    description: 'La lista de informes médicos y análisis',
    load: () => import('./reports.component').then((m) => m.ReportsComponent),
  },
  {
    key: 'report',
    title: 'Informe',
    description: 'Un informe médico entero, para leerlo',
    params: z.object({ id: z.string().min(1).describe('El id del informe, tal como lo ves con read_content en el panel de informes') }),
    load: () => import('../reading').then((m) => m.ReadingComponent),
  },
];
