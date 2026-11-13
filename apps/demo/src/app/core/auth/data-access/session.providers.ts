import type { Provider } from '@angular/core';

import { SessionHttpAdapter } from './session.adapter';
import { SessionPort } from './session.port';

export const provideSession = (): Provider[] => [{ provide: SessionPort, useClass: SessionHttpAdapter }];
