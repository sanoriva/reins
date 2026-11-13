import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { MCP_PATH } from '../../src/adapters/mcp-http.js';
import { BRIDGE_DOWN, relay } from '../../src/adapters/stdio-relay.js';
import { KEY, startBridge } from '../bridge.fixture.js';

let cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn();
  cleanup = [];
});

async function relayedClient(port: number, key = KEY) {
  const [aiSide, relaySide] = InMemoryTransport.createLinkedPair();
  const url = new URL(`http://127.0.0.1:${port}${MCP_PATH}`);
  await relay(relaySide, () => new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${key}` } } }));
  const client = new Client({ name: 'test', version: '0.0.0' });
  cleanup.push(() => client.close());
  await client.connect(aiSide);
  return client;
}

describe('stdio relay', () => {
  it('reaches the bridge with the key: the AI sees its tools', async () => {
    const bridge = await startBridge();
    cleanup.push(bridge.stop);
    const client = await relayedClient(bridge.port);
    const { tools } = await client.listTools();
    assert.ok(tools.some((tool) => tool.name === 'pair_tab'));
  });

  it('opens a new session when the bridge has forgotten the old one', async () => {
    const bridge = await startBridge();
    cleanup.push(bridge.stop);
    const client = await relayedClient(bridge.port);
    await bridge.forgetSessions();
    const { tools } = await client.listTools();
    assert.ok(tools.some((tool) => tool.name === 'pair_tab'));
  });

  it('tells the AI to start the bridge when it is not running', async () => {
    const bridge = await startBridge();
    await bridge.stop();
    await assert.rejects(relayedClient(bridge.port), (error: Error) => error.message.includes(BRIDGE_DOWN));
  });
});
