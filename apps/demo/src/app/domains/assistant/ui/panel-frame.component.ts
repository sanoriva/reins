import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** The frame of a panel: its small name on top, a close button and the screen inside. */
@Component({
  selector: 'vt-panel-frame',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-frame.component.html',
  styleUrl: './panel-frame.component.scss',
})
export class PanelFrameComponent {
  readonly label = input.required<string>();
  readonly closed = output();
}
