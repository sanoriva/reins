import { Injectable } from '@angular/core';

/** Where a screen is rendered: as a routed page (the default) or inside a panel of the assistant page. */
@Injectable({ providedIn: 'root', useFactory: () => ({ inPanel: false }) })
export abstract class PanelContext {
  /** Inside a panel the screen must not change the URL or show "back" links: the panels own the page. */
  abstract readonly inPanel: boolean;
}
