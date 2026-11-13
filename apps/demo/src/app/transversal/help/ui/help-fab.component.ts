import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/** The help button, fixed at the bottom right. */
@Component({
  selector: 'vt-help-fab',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help-fab.component.html',
  styleUrl: './help-fab.component.scss',
})
export class HelpFabComponent {
  readonly opened = output<void>();
}
