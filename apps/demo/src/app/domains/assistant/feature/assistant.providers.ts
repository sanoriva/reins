import type { EnvironmentProviders } from '@angular/core';
import { provideAgentPanels } from '@reins-ai/angular';

import { APPOINTMENTS_PANELS } from '../../appointments';
import { CENTERS_PANELS } from '../../centers';
import { MEDICATION_PANELS } from '../../medication';
import { REPORTS_PANELS } from '../../reports';

/** The panels the AI can open on the assistant page: the ones each domain declares. */
export function provideAssistant(): EnvironmentProviders {
  return provideAgentPanels({
    path: '/asistente',
    panels: [...APPOINTMENTS_PANELS, ...REPORTS_PANELS, ...MEDICATION_PANELS, ...CENTERS_PANELS],
  });
}
