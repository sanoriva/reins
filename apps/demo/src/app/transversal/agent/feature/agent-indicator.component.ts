import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AgentStore } from '../data-access/agent.store';
import { AgentStatusComponent } from '../ui/agent-status.component';

/** The AI status for the top bar. */
@Component({
  selector: 'vt-agent-indicator',
  imports: [AgentStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-indicator.component.html',
})
export class AgentIndicatorComponent {
  protected readonly store = inject(AgentStore);
}
