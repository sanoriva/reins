import type { NoticeDto } from './notice.dto';
import type { Notice } from './notice.model';

export const toNotice = (dto: NoticeDto): Notice => ({ id: dto.id, title: dto.title, body: dto.body, important: dto.tone === 'aviso' });
