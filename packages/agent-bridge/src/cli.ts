#!/usr/bin/env node
import { createServer } from 'node:http';

import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadOrCreateKey } from './adapters/key-file.js';
import { createMcpHandler, MCP_PATH } from './adapters/mcp-http.js';
import { createPageSocket, PAGE_PATH } from './adapters/page-ws.js';
import { relay } from './adapters/stdio-relay.js';
import { TokenFile } from './adapters/token-file.js';
import { routeUpgrades } from './adapters/ws-utils.js';
import { type BridgeConfig, HOST, parseConfig } from './config.js';
import { createBridgeCore } from './core/index.js';

let config: BridgeConfig;
try {
  config = parseConfig(process.argv.slice(2));
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const key = loadOrCreateKey(config.keyFile);

if (config.command === 'print-key') {
  console.log(key);
  process.exit(0);
}

if (config.command === 'stdio') {
  const url = new URL(`http://${HOST}:${config.port}${MCP_PATH}`);
  await relay(new StdioServerTransport(), () => new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${key}` } } }));
} else {
  serve(config, key);
}

function serve(config: BridgeConfig, key: string) {
  const core = createBridgeCore({
    tokenStore: new TokenFile(config.tokensFile),
    onPairingRequest: (origin) => console.log(`${origin} wants to connect: the page shows a code; tell it to your AI.`),
  });

  const mcp = createMcpHandler(core, { port: config.port, key });
  const page = createPageSocket(core, { allowedOrigins: config.allowedOrigins });

  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === MCP_PATH) {
      mcp.handle(req, res).catch((error: Error) => {
        console.error('Error on /mcp:', error.message);
        if (!res.headersSent) res.writeHead(500).end();
      });
      return;
    }
    res.writeHead(404).end();
  });
  routeUpgrades(server, { [PAGE_PATH]: page.handleUpgrade });

  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${config.port} is already in use` : error.message);
    process.exit(1);
  });

  server.listen(config.port, HOST, () => {
    const base = `${HOST}:${config.port}`;
    console.log(`Bridge ready: ws://${base}${PAGE_PATH} (pages) · http://${base}${MCP_PATH} (AI)`);
    console.log(`Allowed origins: ${config.allowedOrigins.join(', ')}`);
    console.log('Connect your AI with: npx @reins-ai/bridge --stdio');
  });

  process.on('SIGINT', () => {
    page.close();
    void mcp.close();
    server.close();
    process.exit(0);
  });
}
