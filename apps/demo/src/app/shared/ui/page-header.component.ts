import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Screen title with its supporting sentence. */
@Component({
  selector: 'vt-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly lead = input<string>();
}
