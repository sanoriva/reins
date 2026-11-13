import type { AgentPanelSpec } from '@reins-ai/angular';

/** Medication also opens as a panel on the assistant page. It loads when opened. */
export const MEDICATION_PANELS: AgentPanelSpec[] = [
  {
    key: 'medication',
    title: 'Medicación',
    description: 'Qué tomar hoy, los tratamientos y pedir la renovación de una receta',
    load: () => import('./medication.component').then((m) => m.MedicationComponent),
  },
];
