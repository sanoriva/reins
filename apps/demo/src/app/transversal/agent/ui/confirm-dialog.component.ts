import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import type { SummaryLine } from '@reins-ai/angular';

/** What awaits confirmation: the summary of what will be sent and the code the person has to say. */
export interface PendingConfirmation {
  code: string;
  summary: SummaryLine[];
  expiresAt: number;
  attemptsLeft: number;
}

@Component({
  selector: 'vt-confirm-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly pending = input.required<PendingConfirmation>();
  private readonly now = signal(Date.now());
  protected readonly secondsLeft = computed(() => Math.max(0, Math.ceil((this.pending().expiresAt - this.now()) / 1000)));
  protected readonly spoken = computed(() => this.pending().code.split('').join(' '));

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
