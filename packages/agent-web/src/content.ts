import { type Content, CONTENT_ROLE } from '@reins-ai/contract';

export interface ContentPart {
  data: unknown;
  more?: boolean;
}

/** Returns the requested part of a screen's content; part 0 is the first. The app decides how to split it. */
export type ContentReader = (part: number) => ContentPart | Promise<ContentPart>;

export interface ProvidedContent {
  type: string;
  read: ContentReader;
}

/** Wraps a part in the content envelope. The role marker is always set here, never by the app. */
export async function readContent(content: ProvidedContent, part: number): Promise<Content> {
  const { data, more } = await content.read(part);
  return { role: CONTENT_ROLE, type: content.type, data, ...(more ? { more: true } : {}) };
}
