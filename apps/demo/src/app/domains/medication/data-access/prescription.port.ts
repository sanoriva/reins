import type { Prescription } from './prescription.model';

export abstract class PrescriptionPort {
  abstract mine(): Promise<Prescription[]>;
  abstract requestRenewal(prescriptionId: string): Promise<Prescription>;
}
