import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The medical terms of the report, explained. It scrolls on its own and is marked for the AI. */
@Component({
  selector: 'vt-glossary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './glossary.component.html',
  styleUrl: './glossary.component.scss',
})
export class GlossaryComponent {
  readonly terms = input.required<{ term: string; meaning: string }[]>();
}
