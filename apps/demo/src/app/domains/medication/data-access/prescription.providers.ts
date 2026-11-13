import type { Provider } from '@angular/core';

import { PrescriptionHttpAdapter } from './prescription.adapter';
import { PrescriptionPort } from './prescription.port';

export const provideMedication = (): Provider[] => [{ provide: PrescriptionPort, useClass: PrescriptionHttpAdapter }];
