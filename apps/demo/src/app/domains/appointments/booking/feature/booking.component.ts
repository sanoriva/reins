import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { AgentService } from '@reins-ai/angular';
import { z } from 'zod';

import { PanelContext } from '../../../../shared/ui/panel-context';
import { PageHeaderComponent } from '../../../../shared/ui/page-header.component';
import type { Appointment } from '../../data-access/appointment.model';
import { AppointmentStore } from '../../data-access/appointment.store';
import { BookingFormComponent } from '../ui/booking-form.component';
import { SlotPickerComponent } from '../ui/slot-picker.component';
import { SpecialtyPickerComponent } from '../ui/specialty-picker.component';

/**
 * Booking an appointment. The specialty goes in the URL (?especialidad=…) and the free slots come from the
 * backend. The form is offered to the AI with the real slots, so it can only pick one that exists, and
 * booking asks for the confirmation code.
 */
@Component({
  selector: 'vt-booking',
  imports: [MatButtonModule, RouterLink, PageHeaderComponent, SpecialtyPickerComponent, SlotPickerComponent, BookingFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss',
})
export class BookingComponent {
  protected readonly store = inject(AppointmentStore);
  private readonly router = inject(Router);
  private readonly agent = inject(AgentService).agent;
  /**
   * The specialty: from the query string as a screen (/citas/nueva?especialidad=…) or from the parameters as
   * a panel.
   */
  readonly especialidad = input<string>();
  protected readonly specialty = linkedSignal(() => this.especialidad() ?? null);
  private readonly inPanel = inject(PanelContext).inPanel;
  protected readonly booked = signal<Appointment | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    slot: ['', Validators.required],
    reason: ['', [Validators.required, Validators.minLength(3)]],
  });

  constructor() {
    void this.store.loadSpecialties();
    effect(() => {
      this.form.reset();
      void this.store.loadSlots(this.specialty());
    });

    const remove = this.agent.provideContent('booking', () => ({
      data: {
        specialties: this.store.specialties().map(({ slug, name }) => ({ slug, name })),
        chosen: this.specialty(),
        freeSlots: this.store.slots().map((s) => s.label),
      },
    }));
    inject(DestroyRef).onDestroy(remove);

    effect((onCleanup) => {
      const labels = this.store.slots().map((s) => s.label);
      if (!labels.length) return;
      onCleanup(
        this.agent.provideForm({
          name: 'appointment',
          description: 'Reservar una cita en un hueco libre',
          fields: z.object({
            slot: z.enum(labels as [string, ...string[]]).describe('Hueco'),
            reason: z.string().trim().min(3).describe('Motivo de la consulta'),
          }),
          fill: (values) => this.form.patchValue(values),
          values: () => this.form.getRawValue(),
          submit: ({ slot, reason }) => this.book(slot, reason),
        }),
      );
    });
  }

  protected chooseSpecialty(slug: string): void {
    this.specialty.set(slug);
    if (!this.inPanel) void this.router.navigate([], { queryParams: { especialidad: slug } });
  }

  protected bookByHand(): void {
    const { slot, reason } = this.form.getRawValue();
    if (this.form.valid) void this.book(slot, reason);
  }

  private async book(label: string, reason: string) {
    const slot = this.store.slots().find((s) => s.label === label);
    if (!slot) throw new Error('Ese hueco ya no está libre');
    const appointment = await this.store.book(slot.id, reason);
    this.booked.set(appointment);
    this.form.reset();
    return { cita: appointment.label };
  }
}
