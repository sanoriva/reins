import assert from 'node:assert/strict';
import { once } from 'node:events';
import { afterEach, describe, it } from 'node:test';

import WebSocket from 'ws';

import { MAX_MESSAGE_BYTES, type PageSocketOptions } from '../../src/adapters/page-ws.js';
import { hello, json, ORIGIN } from '../connection.fake.js';
import { startBridge } from '../bridge.fixture.js';

let stop: (() => Promise<void>) | undefined;
afterEach(async () => {
  await stop?.();
  stop = undefined;
});

async function start(options: Partial<PageSocketOptions> = {}) {
  const bridge = await startBridge(options);
  stop = bridge.stop;
  return bridge;
}

const connect = async (url: string, options: WebSocket.ClientOptions = { origin: ORIGIN }) => {
  const ws = new WebSocket(url, options);
  await once(ws, 'open');
  return ws;
};

const next = async (ws: WebSocket) => {
  const [data] = await once(ws, 'message');
  return JSON.parse(String(data));
};

const rejected = async (url: string, options: WebSocket.ClientOptions) => {
  const ws = new WebSocket(url, options);
  const [error] = await once(ws, 'error');
  return (error as Error).message;
};

const until = async (condition: () => boolean) => {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(condition(), true);
};

describe('page-ws', () => {
  it('answers 403 to an origin that is not allowed, or to no Origin', async () => {
    const { url } = await start();
    assert.match(await rejected(`${url}/page`, { origin: 'https://other-site.com' }), /403/);
    assert.match(await rejected(`${url}/page`, {}), /403/);
  });

  it('answers 404 to any path other than /page', async () => {
    const { url } = await start();
    assert.match(await rejected(`${url}/other`, { origin: ORIGIN }), /404/);
  });

  it('pairs a tab end to end', async () => {
    const { url, core } = await start();
    const ws = await connect(`${url}/page`);
    ws.send(hello('t1'));
    assert.deepEqual(await next(ws), { type: 'pair_required' });
    ws.send(json({ type: 'pair_offer', code: '482913' }));
    await new Promise((r) => setTimeout(r, 20));
    const welcome = next(ws);
    assert.equal(core.pairWithCode('482913').ok, true);
    assert.equal((await welcome).type, 'welcome');
    assert.equal(core.tabs()[0]?.origin, ORIGIN);
    ws.close();
  });

  it('delivers an order to the page and returns its response', async () => {
    const { url, core } = await start();
    const ws = await connect(`${url}/page`);
    ws.send(hello('t1'));
    await next(ws);
    ws.send(json({ type: 'pair_offer', code: '482913' }));
    await new Promise((r) => setTimeout(r, 20));
    const welcome = next(ws);
    core.pairWithCode('482913');
    await welcome;
    const pending = core.sendOrder('t1', 'get_state');
    const order = await next(ws);
    assert.equal(order.action, 'get_state');
    ws.send(json({ id: order.id, ok: true, result: { route: '/' } }));
    assert.deepEqual(await pending, { id: order.id, ok: true, result: { route: '/' } });
    ws.close();
  });

  it('the core removes the tab when it closes', async () => {
    const { url, core } = await start();
    const ws = await connect(`${url}/page`);
    ws.send(hello('t1'));
    await next(ws);
    ws.send(json({ type: 'pair_offer', code: '482913' }));
    await new Promise((r) => setTimeout(r, 20));
    const welcome = next(ws);
    core.pairWithCode('482913');
    await welcome;
    ws.close();
    await until(() => core.tabs().length === 0);
  });

  it('terminates a connection that does not answer the ping', async () => {
    const { url } = await start({ pingIntervalMs: 30 });
    const ws = await connect(`${url}/page`, { origin: ORIGIN, autoPong: false });
    await once(ws, 'close');
  });

  it('closes on messages over 1 MB', async () => {
    const { url } = await start();
    const ws = await connect(`${url}/page`);
    ws.send('x'.repeat(MAX_MESSAGE_BYTES + 1));
    const [code] = await once(ws, 'close');
    assert.equal(code, 1009);
  });
});
