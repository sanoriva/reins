import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { LongDatePipe } from '../../../shared/ui/long-date.pipe';

export interface NextAppointmentView {
  start: Date;
  specialty: string;
  doctor: string;
  center: string;
  reason: string;
}

/** The next appointment, large. */
@Component({
  selector: 'vt-next-appointment',
  imports: [MatButtonModule, LongDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './next-appointment.component.html',
  styleUrl: './next-appointment.component.scss',
})
export class NextAppointmentComponent {
  readonly appointment = input.required<NextAppointmentView | null>();
  readonly seeAll = output<void>();
  readonly book = output<void>();
}
