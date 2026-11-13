import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AgentContent } from '@reins-ai/angular';

import { PanelContext } from '../../../../shared/ui/panel-context';
import { LongDatePipe } from '../../../../shared/ui/long-date.pipe';
import { ReportStore } from '../../data-access/report.store';
import { GlossaryComponent } from '../ui/glossary.component';
import { PreviousTestsComponent } from '../ui/previous-tests.component';
import { ReportBodyComponent } from '../ui/report-body.component';

/**
 * Reading a report. The HTML comes from the clinical system as is, and agentContent offers it to the AI
 * (visible text, in parts). The glossary is a marked box; the previous tests, an unmarked one.
 */
@Component({
  selector: 'vt-reading',
  imports: [MatButtonModule, MatIconModule, RouterLink, AgentContent, LongDatePipe, ReportBodyComponent, GlossaryComponent, PreviousTestsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reading.component.html',
  styleUrl: './reading.component.scss',
})
export class ReadingComponent {
  protected readonly store = inject(ReportStore);
  /** The report id: from the path as a screen (/informes/:id) or from the parameters as a panel. */
  readonly id = input('');
  protected readonly inPanel = inject(PanelContext).inPanel;

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.store.open(id);
    });
  }
}
