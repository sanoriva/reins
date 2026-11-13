import { WebSocketServer, type WebSocket } from 'ws';

import type { BridgeCore } from '../core/index.js';
import { keepAlive, MAX_MESSAGE_BYTES, PING_INTERVAL_MS, reject, type UpgradeHandler } from './ws-utils.js';

export const PAGE_PATH = '/page';
export { MAX_MESSAGE_BYTES } from './ws-utils.js';

export interface PageSocketOptions {
  allowedOrigins: string[];
  pingIntervalMs?: number;
}

/** The `/page` WebSocket: checks the Origin, pings to detect dead tabs and passes text between the tab and the core. */
export function createPageSocket(core: BridgeCore, options: PageSocketOptions) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  const handleUpgrade: UpgradeHandler = (req, socket, head) => {
    const origin = req.headers.origin;
    if (!origin || !options.allowedOrigins.includes(origin)) return reject(socket, 403, 'Forbidden');
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, origin));
  };

  /**
   * ws closes the connection itself after an error (e.g. a message that is too large); this only keeps it from crashing
   * the process.
   */
  function onConnection(ws: WebSocket, origin: string) {
    const session = core.connect({
      origin,
      send: (message) => ws.send(JSON.stringify(message)),
      close: () => ws.close(),
    });
    const stopPing = keepAlive(ws, options.pingIntervalMs ?? PING_INTERVAL_MS);
    ws.on('message', (data, isBinary) => session.receive(isBinary ? '' : data.toString()));
    ws.on('error', () => {});
    ws.on('close', () => {
      stopPing();
      session.disconnected();
    });
  }

  return {
    handleUpgrade,
    close() {
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}
