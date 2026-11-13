import type { DemoPatientDto, PatientDto } from './session.dto';
import type { DemoPatient, Patient } from './session.model';

const age = (birthYear: number) => new Date().getFullYear() - birthYear;

export const toPatient = (dto: PatientDto): Patient => ({
  id: dto.id,
  name: dto.name,
  firstName: dto.name.split(' ')[0] ?? dto.name,
  age: age(dto.birthYear),
  cardNumber: dto.cardNumber,
  center: dto.center,
  doctor: dto.doctor,
});

export const toDemoPatient = (dto: DemoPatientDto): DemoPatient => ({ id: dto.id, name: dto.name, age: age(dto.birthYear) });
