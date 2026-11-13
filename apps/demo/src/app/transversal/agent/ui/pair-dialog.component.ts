import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';

/** The pairing code: the person says it to their AI. Nothing to type. */
@Component({
  selector: 'vt-pair-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pair-dialog.component.html',
  styleUrl: './pair-dialog.component.scss',
})
export class PairDialogComponent {
  readonly code = input.required<string>();
  protected readonly spoken = computed(() => this.code().split('').join(' '));
}
