import type { PrescriptionDto } from './prescription.dto';
import type { Prescription } from './prescription.model';

const DAY = 24 * 60 * 60 * 1000;

export const toPrescription = (dto: PrescriptionDto): Prescription => {
  const until = new Date(`${dto.until}T23:59`);
  const daysLeft = Math.max(0, Math.ceil((until.getTime() - Date.now()) / DAY));
  return {
    id: dto.id,
    medicine: dto.medicine,
    purpose: dto.purpose,
    dose: dto.dose,
    times: dto.times,
    until,
    daysLeft,
    renewalRequested: dto.renewalRequested,
    needsRenewal: daysLeft <= 30 && !dto.renewalRequested,
  };
};
