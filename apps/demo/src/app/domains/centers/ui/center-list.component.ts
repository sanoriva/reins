import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';

export interface CenterRow {
  id: string;
  name: string;
  kind: string;
  address: string;
  town: string;
  phone: string;
}

@Component({
  selector: 'vt-center-list',
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './center-list.component.html',
  styleUrl: './center-list.component.scss',
})
export class CenterListComponent {
  readonly centers = input.required<CenterRow[]>();
  readonly selectedId = input<string | null>(null);
  readonly selected = output<string>();
}
