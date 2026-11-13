import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import { ActionError, AgentService, defineAction, provideAgentActions } from '@reins-ai/angular';
import { z } from 'zod';

import { PanelContext } from '../../../shared/ui/panel-context';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { CenterStore } from '../data-access/center.store';
import { CenterHoursComponent } from '../ui/center-hours.component';
import { CenterListComponent } from '../ui/center-list.component';
import { CenterSearchComponent } from '../ui/center-search.component';

/** Health centres, without a session. The search goes in the URL (?q=…). */
@Component({
  selector: 'vt-centers',
  imports: [PageHeaderComponent, CenterSearchComponent, CenterListComponent, CenterHoursComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './centers.component.html',
  styleUrl: './centers.component.scss',
})
export class CentersComponent {
  protected readonly store = inject(CenterStore);
  private readonly router = inject(Router);
  /** The search: from the query string as a screen (/centros?q=…) or from the parameters as a panel. */
  readonly q = input<string>();
  protected readonly query = linkedSignal(() => this.q() ?? '');
  private readonly inPanel = inject(PanelContext).inPanel;

  constructor() {
    effect(() => void this.store.search(this.query()));

    provideAgentActions([
      defineAction({
        name: 'show_center',
        description: 'Enseña los horarios y servicios de uno de los centros encontrados.',
        params: z.object({ center: z.string().min(1).describe('El id del centro, tal como lo ves con read_content') }),
        run: ({ center }) => {
          if (!this.store.select(center)) throw new ActionError('CENTER_NOT_FOUND', 'Ese centro no está entre los encontrados');
          return { showing: this.store.selected()?.name };
        },
      }),
    ]);

    const remove = inject(AgentService).agent.provideContent('centers', () => ({
      data: { query: this.query(), centers: this.store.centers() },
    }));
    inject(DestroyRef).onDestroy(remove);
  }

  protected search(query: string): void {
    this.query.set(query);
    if (!this.inPanel) void this.router.navigate([], { queryParams: { q: query || null } });
  }
}
