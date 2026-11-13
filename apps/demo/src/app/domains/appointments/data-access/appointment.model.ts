export type AppointmentStatus = 'confirmada' | 'realizada' | 'anulada';

/** A patient appointment. `label` is how it is said out loud: «jueves, 14 de noviembre · 10:30 · Dr. …». */
export interface Appointment {
  id: string;
  start: Date;
  doctor: string;
  specialty: string;
  center: string;
  reason: string;
  status: AppointmentStatus;
  upcoming: boolean;
  label: string;
}

export interface Specialty {
  slug: string;
  name: string;
}

/** A free slot to book. */
export interface Slot {
  id: string;
  start: Date;
  doctor: string;
  center: string;
  label: string;
}
