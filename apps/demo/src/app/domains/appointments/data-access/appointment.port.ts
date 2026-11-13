import type { Appointment, Slot, Specialty } from './appointment.model';

/** What appointments need. */
export abstract class AppointmentPort {
  abstract specialties(): Promise<Specialty[]>;
  abstract freeSlots(specialty: string): Promise<Slot[]>;
  abstract mine(): Promise<Appointment[]>;
  abstract book(slotId: string, reason: string): Promise<Appointment>;
  abstract cancel(appointmentId: string): Promise<Appointment>;
}
