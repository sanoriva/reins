import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE } from '../../api.config';
import type { DemoPatientDto, PatientDto, SignInDto } from './session.dto';
import { toDemoPatient, toPatient } from './session.mapper';
import type { DemoPatient, Patient } from './session.model';
import { SessionPort } from './session.port';

const TOKEN_KEY = 'vitalia.token';

/** The demo's fake session against the backend, with the token stored in the browser. */
@Injectable()
export class SessionHttpAdapter extends SessionPort {
  private readonly http = inject(HttpClient);

  async demoPatients(): Promise<DemoPatient[]> {
    return (await firstValueFrom(this.http.get<DemoPatientDto[]>(`${API_BASE}/patients`))).map(toDemoPatient);
  }

  async signIn(patientId: string): Promise<Patient> {
    const { token, patient } = await firstValueFrom(this.http.post<SignInDto>(`${API_BASE}/auth/fake-login`, { patientId }));
    this.store(token);
    return toPatient(patient);
  }

  async signOut(): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${API_BASE}/auth/logout`, {})).catch(() => undefined);
    this.store(null);
  }

  async restore(): Promise<Patient | null> {
    if (!this.token()) return null;
    try {
      return toPatient(await firstValueFrom(this.http.get<PatientDto>(`${API_BASE}/me`)));
    } catch {
      this.store(null);
      return null;
    }
  }

  token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /** Without storage (private mode) the session lasts as long as the tab. */
  private store(token: string | null): void {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
    }
  }
}
