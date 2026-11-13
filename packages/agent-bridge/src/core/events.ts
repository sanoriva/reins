import type { PageEvent } from '@reins-ai/contract';

export interface QueuedEvent {
  tabId: string;
  event: PageEvent;
}

/** When nobody collects the events, only the latest ones are kept. */
export const MAX_QUEUED_EVENTS = 100;

/** Page events, handed to the AI with its next tool result. */
export class EventQueue {
  private items: QueuedEvent[] = [];
  private readonly listeners = new Set<(item: QueuedEvent) => void>();

  push(tabId: string, event: PageEvent): void {
    const item = { tabId, event };
    this.items.push(item);
    if (this.items.length > MAX_QUEUED_EVENTS) this.items.shift();
    for (const listener of this.listeners) listener(item);
  }

  /** Returns the pending events and empties the queue. */
  drain(): QueuedEvent[] {
    const items = this.items;
    this.items = [];
    return items;
  }

  /** Calls `listener` as soon as each event arrives, e.g. to tell MCP clients the tool list changed. */
  onEvent(listener: (item: QueuedEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
