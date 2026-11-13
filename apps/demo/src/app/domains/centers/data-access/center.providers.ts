import type { Provider } from '@angular/core';

import { CenterHttpAdapter } from './center.adapter';
import { CenterPort } from './center.port';

export const provideCenters = (): Provider[] => [{ provide: CenterPort, useClass: CenterHttpAdapter }];
