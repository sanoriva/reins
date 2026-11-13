import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export interface QuickLink {
  id: string;
  label: string;
  hint: string;
  icon: string;
}

/** Shortcuts to the most common tasks, as a list. */
@Component({
  selector: 'vt-quick-links',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quick-links.component.html',
  styleUrl: './quick-links.component.scss',
})
export class QuickLinksComponent {
  readonly links = input.required<QuickLink[]>();
  readonly chosen = output<string>();
}
