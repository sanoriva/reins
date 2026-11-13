import type { Episode } from './episode.model';

export abstract class EpisodePort {
  abstract mine(): Promise<Episode[]>;
}
