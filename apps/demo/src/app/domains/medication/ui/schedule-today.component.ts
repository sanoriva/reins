import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';

export interface DoseRow {
  time: string;
  medicine: string;
  dose: string;
  purpose: string;
}

/** Today's doses, by time. */
@Component({
  selector: 'vt-schedule-today',
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-today.component.html',
  styleUrl: './schedule-today.component.scss',
})
export class ScheduleTodayComponent {
  readonly doses = input.required<DoseRow[]>();
}
