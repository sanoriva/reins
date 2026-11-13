import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';

/** The HTML comes from the clinical system without Angular attributes, so its styles are not encapsulated. */
@Component({
  selector: 'vt-report-body',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './report-body.component.html',
  styleUrl: './report-body.component.scss',
})
export class ReportBodyComponent {
  readonly html = input.required<string>();
}
