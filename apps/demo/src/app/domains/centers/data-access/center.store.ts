import { computed, inject, Injectable, signal } from '@angular/core';

import type { Center } from './center.model';
import { CenterPort } from './center.port';

/** The centres found and the one chosen to see its opening hours. */
@Injectable({ providedIn: 'root' })
export class CenterStore {
  private readonly port = inject(CenterPort);
  readonly centers = signal<Center[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed((): Center | null => this.centers().find((c) => c.id === this.selectedId()) ?? this.centers()[0] ?? null);

  async search(query: string): Promise<void> {
    this.centers.set(await this.port.search(query));
    this.selectedId.set(null);
  }

  select(centerId: string): boolean {
    if (!this.centers().some((c) => c.id === centerId)) return false;
    this.selectedId.set(centerId);
    return true;
  }
}
