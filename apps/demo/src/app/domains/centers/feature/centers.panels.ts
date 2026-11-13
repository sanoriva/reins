import type { AgentPanelSpec } from '@reins-ai/angular';
import { z } from 'zod';

/** Centres also open as a panel on the assistant page. It loads when opened. */
export const CENTERS_PANELS: AgentPanelSpec[] = [
  {
    key: 'centers',
    title: 'Centros de salud',
    description: 'Buscar centros de salud, hospitales y centros de especialidades, con sus horarios',
    params: z.object({ q: z.string().min(1).describe('Localidad, nombre del centro o servicio que hay que buscar').optional() }),
    load: () => import('./centers.component').then((m) => m.CentersComponent),
  },
];
