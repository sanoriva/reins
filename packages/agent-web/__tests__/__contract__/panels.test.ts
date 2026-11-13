import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { z } from 'zod';

import { type AgentPanel, createPanels, decodePanels, encodePanels } from '../../src/index.js';
import { flush, readyAgent } from '../socket.fake.js';

const panels: AgentPanel[] = [
  { key: 'appointments', title: 'My appointments', description: 'The patient appointments' },
  {
    key: 'report',
    title: 'Report',
    description: 'A medical report',
    params: z.object({ id: z.string().min(1).describe('Report id') }),
  },
];

/** Panels stored in an in-memory "URL". */
function memoryPanels(initial = '', write: (value: string) => unknown = () => {}) {
  let url = initial;
  const created = createPanels({
    panels,
    read: () => url,
    write: (value) => {
      const result = write(value);
      if (result !== false) url = value;
      return result as boolean | void;
    },
  });
  return { panels: created, url: () => url, setUrl: (value: string) => (url = value) };
}

describe('panels in the URL', () => {
  it('are written readably and read back the same, with encoded values', () => {
    const open = [
      { key: 'appointments', params: {} },
      { key: 'report', params: { id: 'café au lait' } },
    ];
    const value = encodePanels(open);
    assert.equal(value, 'appointments,report:id=caf%C3%A9+au+lait');
    assert.deepEqual(decodePanels(value, panels), open);
  });

  it('ignores what does not fit: unknown keys, invalid parameters, duplicates', () => {
    assert.deepEqual(decodePanels('nothing,report,appointments,appointments', panels), [{ key: 'appointments', params: {} }]);
  });
});

describe('createPanels', () => {
  /** Already open: updates its parameters and moves it to the front. */
  it('opening stores the panels in the URL and notifies; the last opened goes last', async () => {
    const t = memoryPanels();
    const seen: string[][] = [];
    t.panels.onChange((open) => seen.push(open.map((p) => p.key)));
    await t.panels.open('report', { id: 'a' });
    await t.panels.open('appointments');
    await t.panels.open('report', { id: 'b' });
    assert.equal(t.url(), 'appointments,report:id=b');
    assert.deepEqual(seen, [[], ['report'], ['report', 'appointments'], ['appointments', 'report']]);
  });

  it('answers INVALID_PARAMS for invalid parameters and changes nothing', async () => {
    const t = memoryPanels();
    await assert.rejects(t.panels.open('report', {}), { code: 'INVALID_PARAMS' });
    assert.equal(t.url(), '');
  });

  it('answers PANEL_NOT_OPEN when closing a panel that is not open', async () => {
    const t = memoryPanels();
    await assert.rejects(t.panels.close('appointments'), { code: 'PANEL_NOT_OPEN' });
  });

  it('answers NOT_AVAILABLE and keeps the previous panels when the app refuses the URL change', async () => {
    const t = memoryPanels('appointments', () => false);
    await assert.rejects(t.panels.open('report', { id: 'a' }), { code: 'NOT_AVAILABLE' });
    assert.deepEqual(t.panels.current, [{ key: 'appointments', params: {} }]);
  });

  /** The initial notice and the change. */
  it('sync reads the URL again (browser back button) and notifies only on change', () => {
    const t = memoryPanels('appointments');
    let changes = 0;
    t.panels.onChange(() => changes++);
    t.panels.sync();
    t.setUrl('report:id=x');
    t.panels.sync();
    assert.equal(changes, 2);
    assert.deepEqual(t.panels.current, [{ key: 'report', params: { id: 'x' } }]);
  });

  it('throws at startup on duplicate keys or a parameter without description', () => {
    assert.throws(() => createPanels({ panels: [panels[0]!, panels[0]!], read: () => '', write: () => {} }), /Duplicate panel keys/);
    const noDescription = [{ key: 'x', description: 'X', params: z.object({ id: z.string() }) }];
    assert.throws(() => createPanels({ panels: noDescription, read: () => '', write: () => {} }), /has no description/);
  });
});

describe('agent with panels', () => {
  const withPanels = () => {
    let url = '';
    return readyAgent([], { panels: { panels, read: () => url, write: (value) => void (url = value) } });
  };
  const send = async (t: ReturnType<typeof readyAgent>, action: string, params: object) => {
    t.socket().receive({ id: action, action, params, page: 0 });
    await flush();
    return t.socket().last() as { result?: any; error?: { code: string } };
  };

  it('gives the AI open_panel and close_panel, and get_state lists the open panels', async () => {
    const t = withPanels();
    const names = ((t.socket().last() as any).data.actions as { name: string }[]).map((a) => a.name);
    assert.ok(names.includes('open_panel') && names.includes('close_panel'));
    assert.deepEqual((await send(t, 'open_panel', { panel: 'report', params: { id: 'a' } })).result, { open: ['report'] });
    assert.deepEqual((await send(t, 'get_state', {})).result.panels, [{ key: 'report', params: { id: 'a' } }]);
    assert.deepEqual((await send(t, 'close_panel', { panel: 'report' })).result, { open: [] });
  });

  it('lists the panels with their parameters in the open_panel description', () => {
    const t = withPanels();
    const open = ((t.socket().last() as any).data.actions as { name: string; description: string }[]).find((a) => a.name === 'open_panel')!;
    assert.match(open.description, /- appointments \(My appointments\): The patient appointments\. No parameters\./);
    assert.match(open.description, /- report \(Report\): A medical report\. Parameters: .*"id"/);
  });

  /** Lets the content.available notice go out. */
  it('read_content reads the last opened panel; once it closes, the previous one', async () => {
    const t = withPanels();
    const removeAppointments = t.agent.provideContent('appointments', () => ({ data: 'appointments' }));
    const removeReport = t.agent.provideContent('report', () => ({ data: 'report' }));
    await new Promise((resolve) => setTimeout(resolve));
    assert.equal((await send(t, 'read_content', {})).result.type, 'report');
    removeReport();
    assert.equal((await send(t, 'read_content', {})).result.type, 'appointments');
    removeAppointments();
    assert.equal((await send(t, 'read_content', {})).error?.code, 'NOT_AVAILABLE');
  });
});
