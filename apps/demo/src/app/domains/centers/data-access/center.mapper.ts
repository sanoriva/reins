import type { CenterDto } from './center.dto';
import type { Center } from './center.model';

const KIND: Record<CenterDto['kind'], string> = {
  'centro-de-salud': 'Centro de salud',
  especialidades: 'Centro de especialidades',
  hospital: 'Hospital',
};

export const toCenter = (dto: CenterDto): Center => ({ ...dto, kind: KIND[dto.kind] });
