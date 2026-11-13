import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The assistant page greeting. `compact`: with panels open, it shrinks to one line. */
@Component({
  selector: 'vt-assistant-welcome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assistant-welcome.component.html',
  styleUrl: './assistant-welcome.component.scss',
  host: { '[class.compact]': 'compact()' },
})
export class AssistantWelcomeComponent {
  readonly name = input.required<string>();
  readonly compact = input(false);
}
