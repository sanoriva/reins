import type { DemoPatient, Patient } from './session.model';

/** What the session needs, not what the backend offers. */
export abstract class SessionPort {
  abstract demoPatients(): Promise<DemoPatient[]>;
  abstract signIn(patientId: string): Promise<Patient>;
  abstract signOut(): Promise<void>;
  /** The stored session, if it is still valid. */
  abstract restore(): Promise<Patient | null>;
  abstract token(): string | null;
}
