import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AgentService } from '@reins-ai/angular';
import { z } from 'zod';

import { AppointmentStore } from '../../data-access/appointment.store';
import { CancellationFormComponent } from '../ui/cancellation-form.component';

/**
 * Cancels a future appointment. It is offered to the AI with the real appointments, and cancelling asks for
 * the confirmation code.
 */
@Component({
  selector: 'vt-cancellation',
  imports: [CancellationFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cancellation.component.html',
  styleUrl: './cancellation.component.scss',
})
export class CancellationComponent {
  private readonly store = inject(AppointmentStore);
  private readonly agent = inject(AgentService).agent;
  protected readonly options = computed(() => this.store.upcoming().map((a) => a.label));
  protected readonly cancelled = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({ appointment: ['', Validators.required] });

  constructor() {
    effect((onCleanup) => {
      const labels = this.options();
      if (!labels.length) return;
      onCleanup(
        this.agent.provideForm({
          name: 'cancellation',
          description: 'Anular una de las próximas citas',
          fields: z.object({ appointment: z.enum(labels as [string, ...string[]]).describe('Cita que se anula') }),
          fill: (values) => this.form.patchValue(values),
          values: () => this.form.getRawValue(),
          submit: ({ appointment }) => this.cancel(appointment),
        }),
      );
    });
  }

  protected cancelByHand(): void {
    if (this.form.valid) void this.cancel(this.form.getRawValue().appointment);
  }

  private async cancel(label: string) {
    const appointment = this.store.upcoming().find((a) => a.label === label);
    if (!appointment) throw new Error('Esa cita ya no está pendiente');
    await this.store.cancel(appointment.id);
    this.cancelled.set(label);
    this.form.reset();
    return { anulada: label };
  }
}
