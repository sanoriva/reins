import { computed, inject, Injectable, signal } from '@angular/core';

import type { Report, ReportDetail } from './report.model';
import { ReportPort } from './report.port';

/** The patient's reports, the type filter and the report being read. */
@Injectable({ providedIn: 'root' })
export class ReportStore {
  private readonly port = inject(ReportPort);
  readonly reports = signal<Report[]>([]);
  readonly kind = signal<string | null>(null);
  readonly current = signal<ReportDetail | null>(null);
  readonly missing = signal(false);
  /** Counts the opens, so a late response for an earlier open does not overwrite the latest one. */
  private opening = 0;

  /** The types present in the patient's reports (not a fixed list). */
  readonly kinds = computed(() => [...new Map(this.reports().map((r) => [r.kind, r.kindLabel])).entries()].map(([kind, label]) => ({ kind, label })));
  readonly visible = computed(() => (this.kind() ? this.reports().filter((r) => r.kind === this.kind()) : this.reports()));

  async load(): Promise<void> {
    this.reports.set(await this.port.mine());
  }

  filterBy(kind: string | null): void {
    this.kind.set(kind);
  }

  async open(reportId: string): Promise<void> {
    const opening = ++this.opening;
    this.current.set(null);
    this.missing.set(false);
    try {
      const report = await this.port.read(reportId);
      if (opening === this.opening) this.current.set(report);
    } catch {
      if (opening === this.opening) this.missing.set(true);
    }
  }
}
