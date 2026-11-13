/** The signed-in patient, as Vitalia understands it. */
export interface Patient {
  id: string;
  name: string;
  firstName: string;
  age: number;
  cardNumber: string;
  center: string;
  doctor: string;
}

/** A demo patient one can sign in as. */
export interface DemoPatient {
  id: string;
  name: string;
  age: number;
}
