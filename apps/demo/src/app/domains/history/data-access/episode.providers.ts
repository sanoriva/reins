import type { Provider } from '@angular/core';

import { EpisodeHttpAdapter } from './episode.adapter';
import { EpisodePort } from './episode.port';

export const provideHistory = (): Provider[] => [{ provide: EpisodePort, useClass: EpisodeHttpAdapter }];
