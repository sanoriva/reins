import type { Provider } from '@angular/core';

import { NoticeHttpAdapter } from './notice.adapter';
import { NoticePort } from './notice.port';

export const provideNotices = (): Provider[] => [{ provide: NoticePort, useClass: NoticeHttpAdapter }];
