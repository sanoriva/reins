import { describe, it } from 'node:test';

import { PageEvent } from '../../src/index.js';
import { highlight, invalid, valid } from '../contract.fixture.js';

describe('PageEvent', () => {
  it('accepts page.changed with the new catalog', () => {
    valid(PageEvent, {
      event: 'page.changed',
      data: { route: '/recipes/7', title: 'Paella', page: 4, actions: [highlight] },
    });
  });

  it('accepts content.available with an app-defined type, and tab.state', () => {
    valid(PageEvent, { event: 'content.available', data: { type: 'recipe', title: 'Paella' } });
    valid(PageEvent, { event: 'tab.state', data: { state: 'background' } });
  });

  it('rejects unknown events and catalogs with invalid actions', () => {
    invalid(PageEvent, { event: 'page.scrolled', data: {} });
    invalid(PageEvent, {
      event: 'page.changed',
      data: { route: '/', title: 'Home', page: 1, actions: [{ name: 'x' }] },
    });
  });
});
