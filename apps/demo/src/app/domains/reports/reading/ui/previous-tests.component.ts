import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { LongDatePipe } from '../../../../shared/ui/long-date.pipe';

/** Related previous tests. It scrolls on its own but is NOT marked: the AI cannot scroll it. */
@Component({
  selector: 'vt-previous-tests',
  imports: [LongDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './previous-tests.component.html',
  styleUrl: './previous-tests.component.scss',
})
export class PreviousTestsComponent {
  readonly tests = input.required<{ date: Date; name: string; result: string }[]>();
}
