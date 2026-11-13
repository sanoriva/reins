import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { LongDatePipe } from '../../../shared/ui/long-date.pipe';

export interface PrescriptionRow {
  id: string;
  medicine: string;
  purpose: string;
  dose: string;
  times: string[];
  until: Date;
  daysLeft: number;
  renewalRequested: boolean;
  needsRenewal: boolean;
}

/** The treatments, with when they end. */
@Component({
  selector: 'vt-prescription-list',
  imports: [LongDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prescription-list.component.html',
  styleUrl: './prescription-list.component.scss',
})
export class PrescriptionListComponent {
  readonly prescriptions = input.required<PrescriptionRow[]>();
}
