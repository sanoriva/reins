import type { AppointmentDto, SlotDto, SpecialtyDto } from './appointment.dto';
import type { Appointment, Slot, Specialty } from './appointment.model';

const day = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const spoken = (start: Date, doctor: string) => `${day.format(start)} · ${time.format(start)} · ${doctor}`;

export const toAppointment = (dto: AppointmentDto): Appointment => {
  const start = new Date(dto.start);
  return {
    id: dto.id,
    start,
    doctor: dto.doctor,
    specialty: dto.specialty,
    center: dto.center,
    reason: dto.reason,
    status: dto.status,
    upcoming: dto.status === 'confirmada' && start.getTime() > Date.now(),
    label: `${dto.specialty} · ${spoken(start, dto.doctor)}`,
  };
};

export const toSpecialty = (dto: SpecialtyDto): Specialty => ({ slug: dto.slug, name: dto.name });

export const toSlot = (dto: SlotDto): Slot => {
  const start = new Date(dto.start);
  return { id: dto.id, start, doctor: dto.doctor, center: dto.center, label: spoken(start, dto.doctor) };
};
