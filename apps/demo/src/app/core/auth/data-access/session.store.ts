import { computed, inject, Injectable, signal } from '@angular/core';

import type { DemoPatient, Patient } from './session.model';
import { SessionPort } from './session.port';

/** Session state: who is signed in. Only the person can sign in; the AI has no action for it. */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly port = inject(SessionPort);
  private readonly patientSignal = signal<Patient | null>(null);

  readonly patient = this.patientSignal.asReadonly();
  readonly signedIn = computed(() => this.patientSignal() !== null);
  readonly demoPatients = signal<DemoPatient[]>([]);

  token(): string | null {
    return this.port.token();
  }

  async restore(): Promise<void> {
    this.patientSignal.set(await this.port.restore());
  }

  async loadDemoPatients(): Promise<void> {
    this.demoPatients.set(await this.port.demoPatients());
  }

  async signIn(patientId: string): Promise<void> {
    this.patientSignal.set(await this.port.signIn(patientId));
  }

  async signOut(): Promise<void> {
    await this.port.signOut();
    this.patientSignal.set(null);
  }
}
