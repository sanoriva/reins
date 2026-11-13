/** Appointments, specialties and free slots as they come over the network. */
export interface AppointmentDto {
  id: string;
  start: string;
  doctor: string;
  specialty: string;
  center: string;
  reason: string;
  status: 'confirmada' | 'realizada' | 'anulada';
}

export interface SpecialtyDto {
  slug: string;
  name: string;
}

export interface SlotDto {
  id: string;
  start: string;
  doctor: string;
  center: string;
}
