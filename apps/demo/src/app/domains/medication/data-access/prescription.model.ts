/** A patient treatment. */
export interface Prescription {
  id: string;
  medicine: string;
  purpose: string;
  dose: string;
  /** Fixed dose times («08:00»); empty when taken only as needed. */
  times: string[];
  until: Date;
  daysLeft: number;
  renewalRequested: boolean;
  /** Less than a month left and no renewal requested yet. */
  needsRenewal: boolean;
}

/** A dose due today. */
export interface Dose {
  time: string;
  medicine: string;
  dose: string;
  purpose: string;
}
