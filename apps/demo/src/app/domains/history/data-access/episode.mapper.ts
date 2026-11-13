import type { EpisodeDto } from './episode.dto';
import type { Episode } from './episode.model';

export const toEpisode = (dto: EpisodeDto): Episode => ({ date: new Date(`${dto.date}T12:00`), title: dto.title, detail: dto.detail });
