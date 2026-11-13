import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AgentService } from '@reins-ai/angular';
import { z } from 'zod';

import { PrescriptionStore } from '../../data-access/prescription.store';
import { RenewalFormComponent } from '../ui/renewal-form.component';

/** Requests the renewal of a prescription that ends soon. It asks for the confirmation code. */
@Component({
  selector: 'vt-renewal',
  imports: [RenewalFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './renewal.component.html',
  styleUrl: './renewal.component.scss',
})
export class RenewalComponent {
  private readonly store = inject(PrescriptionStore);
  private readonly agent = inject(AgentService).agent;
  protected readonly options = computed(() => this.store.needingRenewal().map((p) => p.medicine));
  protected readonly renewed = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({ medicine: ['', Validators.required], note: [''] });

  constructor() {
    effect((onCleanup) => {
      const medicines = this.options();
      if (!medicines.length) return;
      onCleanup(
        this.agent.provideForm({
          name: 'renewal',
          description: 'Pedir la renovación de una receta que termina pronto',
          fields: z.object({
            medicine: z.enum(medicines as [string, ...string[]]).describe('Medicamento'),
            note: z.string().describe('Comentario para el médico').optional(),
          }),
          fill: (values) => this.form.patchValue(values),
          values: () => this.form.getRawValue(),
          submit: ({ medicine }) => this.renew(medicine),
        }),
      );
    });
  }

  protected renewByHand(): void {
    if (this.form.valid) void this.renew(this.form.getRawValue().medicine);
  }

  private async renew(medicine: string) {
    const prescription = this.store.needingRenewal().find((p) => p.medicine === medicine);
    if (!prescription) throw new Error('Esa receta no necesita renovación');
    await this.store.requestRenewal(prescription.id);
    this.renewed.set(medicine);
    this.form.reset();
    return { renovacion: medicine };
  }
}
