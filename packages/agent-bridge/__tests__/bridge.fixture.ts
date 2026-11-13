import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createMcpHandler, MCP_PATH } from '../src/adapters/mcp-http.js';
import { createPageSocket, PAGE_PATH, type PageSocketOptions } from '../src/adapters/page-ws.js';
import { routeUpgrades } from '../src/adapters/ws-utils.js';
import { ORIGIN, testCore } from './connection.fake.js';

export const KEY = 'a'.repeat(64);

/** A real bridge on a free port, wired like cli.ts, with a function to stop it. */
export async function startBridge(pageOptions: Partial<PageSocketOptions> = {}) {
  const t = testCore();
  let mcp: ReturnType<typeof createMcpHandler> | undefined;
  const server = createServer((req, res) => {
    if (req.url?.startsWith(MCP_PATH)) void mcp?.handle(req, res);
    else res.writeHead(404).end();
  });
  const page = createPageSocket(t.core, { allowedOrigins: [ORIGIN], ...pageOptions });
  routeUpgrades(server, { [PAGE_PATH]: page.handleUpgrade });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  mcp = createMcpHandler(t.core, { port, key: KEY });

  const stop = async () => {
    await mcp?.close();
    page.close();
    server.close();
    await once(server, 'close');
  };
  return { ...t, port, url: `ws://127.0.0.1:${port}`, stop, forgetSessions: () => mcp!.close() };
}
