/** The patient and the session as they come over the network. */
export interface PatientDto {
  id: string;
  name: string;
  birthYear: number;
  cardNumber: string;
  center: string;
  doctor: string;
}

export interface DemoPatientDto {
  id: string;
  name: string;
  birthYear: number;
}

export interface SignInDto {
  token: string;
  patient: PatientDto;
}
