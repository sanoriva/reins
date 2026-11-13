import { ChangeDetectionStrategy, Component, inject, type TemplateRef, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { type ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import type { Help } from '../data-access/help.model';
import { HelpDialogComponent } from '../ui/help-dialog.component';
import { HelpFabComponent } from '../ui/help-fab.component';
import { COMMON_HELP } from './common.help';

/** The help of the current screen: data.help of the deepest route. */
function currentHelp(router: Router): Help | undefined {
  let route: ActivatedRouteSnapshot | null = router.routerState.snapshot.root;
  let help: Help | undefined;
  for (; route; route = route.firstChild) help = (route.data['help'] as Help | undefined) ?? help;
  return help;
}

/** The help button of every screen and the dialog with its use cases. */
@Component({
  selector: 'vt-help',
  imports: [HelpFabComponent, HelpDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help.component.html',
})
export class HelpComponent {
  private readonly router = inject(Router);
  private readonly dialogs = inject(MatDialog);
  private readonly dialog = viewChild<TemplateRef<unknown>>('dialog');
  protected readonly common = COMMON_HELP;
  protected readonly help = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => currentHelp(this.router)),
    ),
  );

  protected open(): void {
    const dialog = this.dialog();
    if (dialog) this.dialogs.open(dialog, { width: '800px', maxWidth: '96vw', autoFocus: false });
  }
}
