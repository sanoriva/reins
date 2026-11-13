import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE } from '../../../core/api.config';
import type { CenterDto } from './center.dto';
import { toCenter } from './center.mapper';
import type { Center } from './center.model';
import { CenterPort } from './center.port';

@Injectable()
export class CenterHttpAdapter extends CenterPort {
  private readonly http = inject(HttpClient);

  async search(query: string): Promise<Center[]> {
    const params = query ? { q: query } : undefined;
    return (await firstValueFrom(this.http.get<CenterDto[]>(`${API_BASE}/centers`, { params }))).map(toCenter);
  }
}
