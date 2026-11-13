import type { Provider } from '@angular/core';

import { AppointmentHttpAdapter } from './appointment.adapter';
import { AppointmentPort } from './appointment.port';

export const provideAppointments = (): Provider[] => [{ provide: AppointmentPort, useClass: AppointmentHttpAdapter }];
