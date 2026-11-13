import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { type FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

/** Picks the appointment to cancel. */
@Component({
  selector: 'vt-cancellation-form',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cancellation-form.component.html',
  styleUrl: './cancellation-form.component.scss',
})
export class CancellationFormComponent {
  readonly form = input.required<FormGroup>();
  readonly options = input.required<string[]>();
  readonly submitted = output<void>();
}
