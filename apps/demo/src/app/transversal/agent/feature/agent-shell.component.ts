import { ChangeDetectionStrategy, Component, effect, inject, type TemplateRef, viewChild } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';

import { AgentStore } from '../data-access/agent.store';
import { ConfirmDialogComponent } from '../ui/confirm-dialog.component';
import { PairDialogComponent } from '../ui/pair-dialog.component';

/**
 * Opens and closes the two code dialogs following the AI state: pairing (6 digits) and confirming a
 * submission (4 digits). They close by themselves once they are no longer needed.
 */
@Component({
  selector: 'vt-agent-shell',
  imports: [PairDialogComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-shell.component.html',
})
export class AgentShellComponent {
  protected readonly store = inject(AgentStore);
  private readonly dialog = inject(MatDialog);
  private readonly pairing = viewChild.required<TemplateRef<unknown>>('pairing');
  private readonly confirming = viewChild.required<TemplateRef<unknown>>('confirming');

  constructor() {
    this.whileTrue(() => this.store.pairingCode() !== null, () => this.pairing(), '440px');
    this.whileTrue(() => this.store.pendingConfirmation() !== null, () => this.confirming(), '520px');
  }

  /** Keeps a dialog open while the condition holds. */
  private whileTrue(condition: () => boolean, template: () => TemplateRef<unknown>, width: string): void {
    let ref: MatDialogRef<unknown> | undefined;
    effect(() => {
      if (condition() && !ref) ref = this.dialog.open(template(), { disableClose: true, width, autoFocus: false });
      else if (!condition() && ref) {
        ref.close();
        ref = undefined;
      }
    });
  }
}
