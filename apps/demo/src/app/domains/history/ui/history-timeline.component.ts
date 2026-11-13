import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { LongDatePipe } from '../../../shared/ui/long-date.pipe';

@Component({
  selector: 'vt-history-timeline',
  imports: [LongDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-timeline.component.html',
  styleUrl: './history-timeline.component.scss',
})
export class HistoryTimelineComponent {
  readonly episodes = input.required<{ date: Date; title: string; detail: string }[]>();
}
