import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE } from '../../../core/api.config';
import type { NoticeDto } from './notice.dto';
import { toNotice } from './notice.mapper';
import type { Notice } from './notice.model';
import { NoticePort } from './notice.port';

@Injectable()
export class NoticeHttpAdapter extends NoticePort {
  private readonly http = inject(HttpClient);

  async forMe(): Promise<Notice[]> {
    return (await firstValueFrom(this.http.get<NoticeDto[]>(`${API_BASE}/notices`))).map(toNotice);
  }
}
