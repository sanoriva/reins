import { inject, Injectable, signal } from '@angular/core';

import type { Notice } from './notice.model';
import { NoticePort } from './notice.port';

@Injectable({ providedIn: 'root' })
export class NoticeStore {
  private readonly port = inject(NoticePort);
  readonly notices = signal<Notice[]>([]);

  async load(): Promise<void> {
    this.notices.set(await this.port.forMe());
  }
}
