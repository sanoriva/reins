import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { LongDatePipe } from '../../../shared/ui/long-date.pipe';

/** What an appointment row shows. */
export interface AppointmentRow {
  id: string;
  start: Date;
  specialty: string;
  doctor: string;
  center: string;
  reason: string;
  status: string;
}

/** A list of appointments with the date clearly visible. */
@Component({
  selector: 'vt-appointment-list',
  imports: [LongDatePipe, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointment-list.component.html',
  styleUrl: './appointment-list.component.scss',
})
export class AppointmentListComponent {
  readonly appointments = input.required<AppointmentRow[]>();
  readonly emptyMessage = input('No hay citas.');
}
