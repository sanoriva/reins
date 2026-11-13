import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

export interface LoginOption {
  id: string;
  name: string;
  age: number;
}

/** Signs in as a demo patient: one button, no password. */
@Component({
  selector: 'vt-login-card',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-card.component.html',
  styleUrl: './login-card.component.scss',
})
export class LoginCardComponent {
  readonly patients = input.required<LoginOption[]>();
  readonly signIn = output<string>();
}
