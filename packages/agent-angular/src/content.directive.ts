import { Directive, effect, ElementRef, inject, input } from '@angular/core';
import { readElement } from '@reins-ai/web';

import { AgentService } from './agent.service';

/**
 * Offers the visible text of this element to the AI as the screen's content (`read_content`), with nothing to
 * prepare. The value is the content type, chosen by the app. The content is withdrawn when the element is
 * destroyed.
 *
 * @example
 * <article agentContent="article" [innerHTML]="html"></article>
 */
@Directive({ selector: '[agentContent]' })
export class AgentContent {
  readonly agentContent = input.required<string>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const { agent } = inject(AgentService);
    effect((onCleanup) => onCleanup(agent.provideContent(this.agentContent(), readElement(() => element))));
  }
}
