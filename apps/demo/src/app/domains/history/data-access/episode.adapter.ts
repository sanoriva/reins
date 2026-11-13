import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE } from '../../../core/api.config';
import type { EpisodeDto } from './episode.dto';
import { toEpisode } from './episode.mapper';
import type { Episode } from './episode.model';
import { EpisodePort } from './episode.port';

@Injectable()
export class EpisodeHttpAdapter extends EpisodePort {
  private readonly http = inject(HttpClient);

  async mine(): Promise<Episode[]> {
    return (await firstValueFrom(this.http.get<EpisodeDto[]>(`${API_BASE}/history`))).map(toEpisode);
  }
}
