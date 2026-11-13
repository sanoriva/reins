import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export interface NoticeView {
  id: string;
  title: string;
  body: string;
  important: boolean;
}

/** Notices for the patient. */
@Component({
  selector: 'vt-notice-list',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notice-list.component.html',
  styleUrl: './notice-list.component.scss',
})
export class NoticeListComponent {
  readonly notices = input.required<NoticeView[]>();
}
