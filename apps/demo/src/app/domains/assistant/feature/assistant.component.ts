import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, Injector } from '@angular/core';
import { AgentPanels } from '@reins-ai/angular';

import { SessionStore } from '../../../core/auth';
import { PanelContext } from '../../../shared/ui/panel-context';
import { AssistantWelcomeComponent } from '../ui/assistant-welcome.component';
import { PanelFrameComponent } from '../ui/panel-frame.component';

/**
 * The assistant page: clean, with a greeting. What the user asks for appears here as panels the AI opens
 * (open_panel), sliding in, with the last one opened on top. Each panel is the usual screen, which knows it
 * is inside a panel (PanelContext) and gets its parameters as inputs.
 */
@Component({
  selector: 'vt-assistant',
  imports: [NgComponentOutlet, AssistantWelcomeComponent, PanelFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assistant.component.html',
  styleUrl: './assistant.component.scss',
})
export class AssistantComponent {
  private readonly panels = inject(AgentPanels);
  private readonly session = inject(SessionStore);
  protected readonly firstName = computed(() => this.session.patient()?.firstName ?? '');
  /** The last one opened goes on top: it is the one just asked for. */
  protected readonly newestFirst = computed(() => [...this.panels.current()].reverse());
  /** Screens rendered here know they are inside a panel. */
  protected readonly panelInjector = Injector.create({ providers: [{ provide: PanelContext, useValue: { inPanel: true } satisfies PanelContext }], parent: inject(Injector) });

  protected close(key: string): void {
    void this.panels.close(key);
  }
}
