import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { AgentService } from '@reins-ai/angular';

import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { PrescriptionStore } from '../data-access/prescription.store';
import { RenewalComponent } from '../renewal';
import { PrescriptionListComponent } from '../ui/prescription-list.component';
import { ScheduleTodayComponent } from '../ui/schedule-today.component';

/** Medication: what to take today, the treatments and prescription renewal. */
@Component({
  selector: 'vt-medication',
  imports: [PageHeaderComponent, ScheduleTodayComponent, PrescriptionListComponent, RenewalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './medication.component.html',
  styleUrl: './medication.component.scss',
})
export class MedicationComponent {
  protected readonly store = inject(PrescriptionStore);

  constructor() {
    void this.store.load();

    const remove = inject(AgentService).agent.provideContent('medication', () => ({
      data: {
        today: this.store.today(),
        treatments: this.store.prescriptions().map(({ medicine, purpose, dose, times, daysLeft, renewalRequested }) => ({
          medicine,
          purpose,
          dose,
          times,
          daysLeft,
          renewalRequested,
        })),
      },
    }));
    inject(DestroyRef).onDestroy(remove);
  }
}
