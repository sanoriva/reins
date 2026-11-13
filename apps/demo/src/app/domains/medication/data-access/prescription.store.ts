import { computed, inject, Injectable, signal } from '@angular/core';

import type { Dose, Prescription } from './prescription.model';
import { PrescriptionPort } from './prescription.port';

/** The patient's treatments and today's doses. */
@Injectable({ providedIn: 'root' })
export class PrescriptionStore {
  private readonly port = inject(PrescriptionPort);
  readonly prescriptions = signal<Prescription[]>([]);

  readonly today = computed<Dose[]>(() =>
    this.prescriptions()
      .flatMap((p) => p.times.map((time) => ({ time, medicine: p.medicine, dose: p.dose, purpose: p.purpose })))
      .sort((a, b) => a.time.localeCompare(b.time)),
  );
  readonly needingRenewal = computed(() => this.prescriptions().filter((p) => p.needsRenewal));

  async load(): Promise<void> {
    this.prescriptions.set(await this.port.mine());
  }

  async requestRenewal(prescriptionId: string): Promise<Prescription> {
    const renewed = await this.port.requestRenewal(prescriptionId);
    this.prescriptions.update((list) => list.map((p) => (p.id === renewed.id ? renewed : p)));
    return renewed;
  }
}
