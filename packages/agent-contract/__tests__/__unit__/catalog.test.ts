import { describe, it } from 'node:test';

import { ActionDefinition } from '../../src/index.js';
import { highlight, invalid, valid } from '../contract.fixture.js';

describe('ActionDefinition', () => {
  it('accepts an action in MCP format with scope and effect', () => {
    valid(ActionDefinition, highlight);
  });

  it('accepts dotted names', () => {
    valid(ActionDefinition, { ...highlight, name: 'articles.search', scope: 'page' });
  });

  it('rejects names with spaces, unknown scope or effect, and non-object schemas', () => {
    invalid(ActionDefinition, { ...highlight, name: 'highlight text' });
    invalid(ActionDefinition, { ...highlight, scope: 'global' });
    invalid(ActionDefinition, { ...highlight, effect: 'submit' });
    invalid(ActionDefinition, { ...highlight, inputSchema: { type: 'string' } });
  });
});
