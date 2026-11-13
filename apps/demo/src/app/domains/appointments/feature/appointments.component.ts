import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AgentService, defineAction, provideAgentActions } from '@reins-ai/angular';
import { z } from 'zod';

import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { AppointmentStore } from '../data-access/appointment.store';
import { CancellationComponent } from '../cancellation';
import { AppointmentListComponent } from '../ui/appointment-list.component';

/** My appointments: upcoming ones (with sorting and cancellation) and past ones. */
@Component({
  selector: 'vt-appointments',
  imports: [MatButtonModule, MatButtonToggleModule, MatIconModule, RouterLink, PageHeaderComponent, AppointmentListComponent, CancellationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.scss',
})
export class AppointmentsComponent {
  protected readonly store = inject(AppointmentStore);

  constructor() {
    void this.store.load();

    provideAgentActions([
      defineAction({
        name: 'sort_appointments',
        description: 'Ordena las próximas citas que se ven en pantalla.',
        params: z.object({ by: z.enum(['date', 'specialty']).describe('date: por fecha, la más cercana primero; specialty: por especialidad') }),
        run: ({ by }) => {
          this.store.sortBy(by);
          return { order: by, upcoming: this.store.upcoming().map((a) => a.label) };
        },
      }),
    ]);

    const remove = inject(AgentService).agent.provideContent('appointments', () => ({
      data: {
        upcoming: this.store.upcoming().map(({ label, center, reason }) => ({ cita: label, center, reason })),
        past: this.store.past().map(({ label, status }) => ({ cita: label, status })),
      },
    }));
    inject(DestroyRef).onDestroy(remove);
  }
}
