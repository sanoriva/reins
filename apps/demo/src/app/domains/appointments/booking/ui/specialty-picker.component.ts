import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';

export interface SpecialtyOption {
  slug: string;
  name: string;
}

/** Picks a specialty. */
@Component({
  selector: 'vt-specialty-picker',
  imports: [MatChipsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './specialty-picker.component.html',
})
export class SpecialtyPickerComponent {
  readonly specialties = input.required<SpecialtyOption[]>();
  readonly selected = input<string | null>(null);
  readonly picked = output<string>();
}
