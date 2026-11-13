import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface CenterHoursView {
  name: string;
  hours: { days: string; open: string }[];
  services: string[];
}

/** Opening hours and services of the chosen centre. The box scrolls on its own and is marked for the AI. */
@Component({
  selector: 'vt-center-hours',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './center-hours.component.html',
  styleUrl: './center-hours.component.scss',
})
export class CenterHoursComponent {
  readonly center = input.required<CenterHoursView>();
}
