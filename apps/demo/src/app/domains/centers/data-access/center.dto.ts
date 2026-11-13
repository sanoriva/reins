export interface CenterDto {
  id: string;
  name: string;
  kind: 'centro-de-salud' | 'especialidades' | 'hospital';
  address: string;
  town: string;
  phone: string;
  hours: { days: string; open: string }[];
  services: string[];
}
