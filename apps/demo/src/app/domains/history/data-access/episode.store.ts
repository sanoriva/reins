import { inject, Injectable, signal } from '@angular/core';

import type { Episode } from './episode.model';
import { EpisodePort } from './episode.port';

@Injectable({ providedIn: 'root' })
export class EpisodeStore {
  private readonly port = inject(EpisodePort);
  readonly episodes = signal<Episode[]>([]);

  async load(): Promise<void> {
    this.episodes.set(await this.port.mine());
  }
}
