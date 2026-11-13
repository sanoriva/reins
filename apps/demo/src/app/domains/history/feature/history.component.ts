import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { EpisodeStore } from '../data-access/episode.store';
import { HistoryTimelineComponent } from '../ui/history-timeline.component';

/** The full medical history: for the person only. It offers nothing to the AI. */
@Component({
  selector: 'vt-history',
  imports: [MatIconModule, PageHeaderComponent, HistoryTimelineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  protected readonly store = inject(EpisodeStore);

  constructor() {
    void this.store.load();
  }
}
