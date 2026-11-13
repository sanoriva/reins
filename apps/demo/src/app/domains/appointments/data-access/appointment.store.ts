import { computed, inject, Injectable, signal } from '@angular/core';

import type { Appointment, Slot, Specialty } from './appointment.model';
import { AppointmentPort } from './appointment.port';

export type AppointmentOrder = 'date' | 'specialty';

/** Appointment state: the patient's appointments, the specialties and the free slots of the chosen one. */
@Injectable({ providedIn: 'root' })
export class AppointmentStore {
  private readonly port = inject(AppointmentPort);

  readonly appointments = signal<Appointment[]>([]);
  readonly specialties = signal<Specialty[]>([]);
  readonly slots = signal<Slot[]>([]);
  readonly order = signal<AppointmentOrder>('date');

  private readonly byDate = computed(() => [...this.appointments()].sort((a, b) => a.start.getTime() - b.start.getTime()));
  /** The next appointment, by date. */
  readonly next = computed(() => this.byDate().find((a) => a.upcoming) ?? null);
  readonly upcoming = computed(() => {
    const list = this.byDate().filter((a) => a.upcoming);
    return this.order() === 'specialty' ? [...list].sort((a, b) => a.specialty.localeCompare(b.specialty)) : list;
  });
  readonly past = computed(() => this.byDate().filter((a) => !a.upcoming).reverse());

  async load(): Promise<void> {
    this.appointments.set(await this.port.mine());
  }

  async loadSpecialties(): Promise<void> {
    if (!this.specialties().length) this.specialties.set(await this.port.specialties());
  }

  async loadSlots(specialty: string | null): Promise<void> {
    this.slots.set(specialty ? await this.port.freeSlots(specialty) : []);
  }

  sortBy(order: AppointmentOrder): void {
    this.order.set(order);
  }

  async book(slotId: string, reason: string): Promise<Appointment> {
    const booked = await this.port.book(slotId, reason);
    this.slots.update((slots) => slots.filter((s) => s.id !== slotId));
    await this.load();
    return booked;
  }

  async cancel(appointmentId: string): Promise<Appointment> {
    const cancelled = await this.port.cancel(appointmentId);
    await this.load();
    return cancelled;
  }
}
