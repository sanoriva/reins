import type { Notice } from './notice.model';

export abstract class NoticePort {
  abstract forMe(): Promise<Notice[]>;
}
