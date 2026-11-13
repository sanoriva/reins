import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { type FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

/** Requests a prescription renewal. */
@Component({
  selector: 'vt-renewal-form',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './renewal-form.component.html',
  styleUrl: './renewal-form.component.scss',
})
export class RenewalFormComponent {
  readonly form = input.required<FormGroup>();
  readonly options = input.required<string[]>();
  readonly submitted = output<void>();
}
