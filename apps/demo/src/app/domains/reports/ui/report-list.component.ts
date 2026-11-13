import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { LongDatePipe } from '../../../shared/ui/long-date.pipe';

export interface ReportRow {
  id: string;
  title: string;
  kindLabel: string;
  date: Date;
  doctor: string;
  summary: string;
}

@Component({
  selector: 'vt-report-list',
  imports: [MatIconModule, LongDatePipe, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-list.component.html',
  styleUrl: './report-list.component.scss',
})
export class ReportListComponent {
  readonly reports = input.required<ReportRow[]>();
  readonly opened = output<string>();
}
