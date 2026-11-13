import type { Center } from './center.model';

export abstract class CenterPort {
  abstract search(query: string): Promise<Center[]>;
}
