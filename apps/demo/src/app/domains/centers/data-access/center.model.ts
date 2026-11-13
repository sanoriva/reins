/** A centre of the Vitalia network. */
export interface Center {
  id: string;
  name: string;
  kind: string;
  address: string;
  town: string;
  phone: string;
  hours: { days: string; open: string }[];
  services: string[];
}
