import type { ActionDefinition, PageEvent } from '@reins-ai/contract';

import type { Connection } from './ports.js';

type PageChangedData = Extract<PageEvent, { event: 'page.changed' }>['data'];

/** What the bridge knows about a connected tab. `page` is the last screen counter received. */
export interface TabInfo {
  tabId: string;
  origin: string;
  page: number;
  route: string;
  title: string;
  actions: ActionDefinition[];
  state: 'active' | 'background';
}

interface Tab {
  info: TabInfo;
  connection: Connection;
  unpair(): void;
}

/** The connected tabs. */
export class Tabs {
  private readonly tabs = new Map<string, Tab>();

  /** A reloaded tab comes back with the same tabId and replaces the previous one. */
  add(tabId: string, connection: Connection, unpair: () => void = () => {}): void {
    this.tabs.set(tabId, {
      connection,
      unpair,
      info: { tabId, origin: connection.origin, page: 0, route: '', title: '', actions: [], state: 'active' },
    });
  }

  /** Removes the tab only if it still belongs to that connection; a reload may have replaced it already. */
  remove(tabId: string, connection: Connection): boolean {
    if (this.tabs.get(tabId)?.connection !== connection) return false;
    return this.tabs.delete(tabId);
  }

  get(tabId: string): Tab | undefined {
    return this.tabs.get(tabId);
  }

  list(): TabInfo[] {
    return [...this.tabs.values()].map(({ info }) => ({ ...info, actions: [...info.actions] }));
  }

  pageChanged(tabId: string, data: PageChangedData): void {
    const tab = this.tabs.get(tabId);
    if (tab) Object.assign(tab.info, data);
  }

  /** `closed` changes nothing: the disconnection comes right after. */
  tabState(tabId: string, state: 'active' | 'background' | 'closed'): void {
    const tab = this.tabs.get(tabId);
    if (tab && state !== 'closed') tab.info.state = state;
  }
}
