import { DestroyRef, inject } from '@angular/core';
import type { FormSpec } from '@reins-ai/web';

import { AgentService } from './agent.service';

/** The part of an Angular form the library uses. A `FormGroup` fits as is. */
export interface AgentFormGroup {
  patchValue(value: object): void;
  getRawValue(): unknown;
}

/** A screen form: the AI fills it with `patchValue` and the library reads it with `getRawValue`. */
export interface AgentFormSpec<S extends FormSpec['fields']> extends Pick<FormSpec<S>, 'name' | 'description' | 'fields' | 'submit'> {
  form: AgentFormGroup;
}

/**
 * Offers this screen's form to the AI: `fill_<name>` fills in what the user dictates and `submit_<name>`
 * submits it after the user says the confirmation code. Call it in the component constructor; it is withdrawn
 * when the component is destroyed.
 *
 * @example
 * constructor() {
 *   provideAgentForm({
 *     name: 'appointment',
 *     description: 'Book an appointment',
 *     fields: z.object({ reason: z.string().min(3).describe('Reason for the visit') }),
 *     form: this.form,
 *     submit: (values) => this.api.book(values),
 *   });
 * }
 */
export function provideAgentForm<S extends FormSpec['fields']>({ form, ...spec }: AgentFormSpec<S>): void {
  const { agent } = inject(AgentService);
  const remove = agent.provideForm({
    ...spec,
    fill: (values) => form.patchValue(values),
    values: () => form.getRawValue(),
  });
  inject(DestroyRef).onDestroy(remove);
}
