import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';

/** One use case as the dialog shows it. */
export interface HelpCaseView {
  title: string;
  say: string;
  action: string;
  what: string;
  how: string;
  code: string;
  file?: string;
}

/** The help of one screen as the dialog shows it. */
export interface HelpView {
  title: string;
  intro: string;
  file: string;
  cases: readonly HelpCaseView[];
}

/** The use cases of the screen; expanding one shows how it is built, with its code. */
@Component({
  selector: 'vt-help-dialog',
  imports: [MatButtonModule, MatDialogModule, MatExpansionModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help-dialog.component.html',
  styleUrl: './help-dialog.component.scss',
})
export class HelpDialogComponent {
  readonly page = input.required<HelpView>();
  readonly common = input.required<HelpView>();
  protected readonly sections = computed(() => [
    { title: 'En esta pantalla', help: this.page() },
    { title: 'En cualquier pantalla', help: this.common() },
  ]);
}
