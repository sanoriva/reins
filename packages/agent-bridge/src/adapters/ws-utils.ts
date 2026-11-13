import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import type { WebSocket } from 'ws';

export const PING_INTERVAL_MS = 15_000;
export const MAX_MESSAGE_BYTES = 1024 * 1024;

export type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

/** Routes each WebSocket upgrade to the handler of its path; any other path gets a 404. */
export function routeUpgrades(server: Server, routes: Record<string, UpgradeHandler>): void {
  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const handler = routes[path];
    if (handler) handler(req, socket, head);
    else reject(socket, 404, 'Not Found');
  });
}

export function reject(socket: Duplex, status: number, text: string): void {
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/** Pings periodically; a connection with no pong before the next ping is dead and is terminated. Returns a stop function. */
export function keepAlive(ws: WebSocket, intervalMs: number): () => void {
  let alive = true;
  ws.on('pong', () => (alive = true));
  const timer = setInterval(() => {
    if (!alive) return ws.terminate();
    alive = false;
    ws.ping();
  }, intervalMs);
  return () => clearInterval(timer);
}
