export interface PrescriptionDto {
  id: string;
  medicine: string;
  purpose: string;
  dose: string;
  times: string[];
  until: string;
  renewalRequested: boolean;
}
