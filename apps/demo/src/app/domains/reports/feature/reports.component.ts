import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { Router } from '@angular/router';
import { AgentService, defineAction } from '@reins-ai/angular';
import { z } from 'zod';

import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { ReportStore } from '../data-access/report.store';
import { ReportListComponent } from '../ui/report-list.component';

/** My reports, with a filter by type. */
@Component({
  selector: 'vt-reports',
  imports: [MatChipsModule, PageHeaderComponent, ReportListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  protected readonly store = inject(ReportStore);
  private readonly router = inject(Router);
  private readonly agent = inject(AgentService).agent;

  constructor() {
    void this.store.load();

    effect((onCleanup) => {
      const kinds = this.store.kinds().map((k) => k.kind);
      if (!kinds.length) return;
      onCleanup(
        this.agent.provideActions([
          defineAction({
            name: 'filter_reports',
            description: 'Filtra los informes que se ven por su tipo.',
            params: z.object({ kind: z.enum(kinds as [string, ...string[]]).nullable().describe('El tipo de informe, tal como lo ves con read_content; null para verlos todos') }),
            run: ({ kind }) => {
              this.store.filterBy(kind);
              return { kind, reports: this.store.visible().map((r) => r.title) };
            },
          }),
        ]),
      );
    });

    const remove = this.agent.provideContent('reports', () => ({
      data: this.store.visible().map(({ id, title, kindLabel, kind, date, doctor, summary }) => ({ id, title, kind, kindLabel, date: date.toISOString().slice(0, 10), doctor, summary })),
    }));
    inject(DestroyRef).onDestroy(remove);
  }

  protected open(reportId: string): void {
    void this.router.navigate(['/informes', reportId]);
  }
}
