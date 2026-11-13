import type { Provider } from '@angular/core';

import { ReportHttpAdapter } from './report.adapter';
import { ReportPort } from './report.port';

export const provideReports = (): Provider[] => [{ provide: ReportPort, useClass: ReportHttpAdapter }];
