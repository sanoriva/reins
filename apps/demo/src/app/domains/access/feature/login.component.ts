import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import { SessionStore } from '../../../core/auth';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { LoginCardComponent } from '../ui/login-card.component';

/** Signing in to Vitalia. It offers nothing to the AI: identifying yourself is up to the person. */
@Component({
  selector: 'vt-login',
  imports: [MatButtonModule, PageHeaderComponent, LoginCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  protected readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  constructor() {
    void this.session.loadDemoPatients();
  }

  protected async signIn(patientId: string): Promise<void> {
    await this.session.signIn(patientId);
    await this.router.navigateByUrl('/');
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
  }
}
