import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  isInitializedNotification,
  isInitializeRequest,
  isJSONRPCRequest,
  type JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';

export const BRIDGE_DOWN = 'The Reins bridge is not running: start it with npx @reins-ai/bridge --allow-origin <your site>';
const REPLAY_ID = 'reins-relay-initialize';

/**
 * If the bridge restarts, its MCP session is gone: the relay opens a new one once, repeating the AI's handshake, and
 * sends again every message that failed with the old one.
 */
export async function relay(local: Transport, openRemote: () => Transport): Promise<void> {
  let remote: Transport;
  let handshake: JSONRPCMessage[] = [];
  let protocolVersion: string | undefined;
  let reopening: Promise<void> | undefined;

  const open = async () => {
    const next = openRemote();
    if (protocolVersion) next.setProtocolVersion?.(protocolVersion);
    next.onmessage = (message) => {
      if ('id' in message && message.id === REPLAY_ID) return;
      const version = 'result' in message ? message.result['protocolVersion'] : undefined;
      if (typeof version === 'string') {
        protocolVersion = version;
        next.setProtocolVersion?.(version);
      }
      void local.send(message);
    };
    await next.start();
    remote = next;
  };

  const reopen = async () => {
    await open();
    const [initialize, ...rest] = handshake;
    await remote.send({ ...initialize!, id: REPLAY_ID } as JSONRPCMessage);
    for (const next of rest) await remote.send(next);
  };

  const forward = async (message: JSONRPCMessage) => {
    if (isInitializeRequest(message)) handshake = [message];
    else if (isInitializedNotification(message)) handshake.push(message);
    const used = remote;
    try {
      await used.send(message);
    } catch (error) {
      const expired = error instanceof StreamableHTTPError && error.code === 404;
      if (!expired || handshake.length === 0) throw error;
      if (used === remote) reopening ??= reopen().finally(() => (reopening = undefined));
      await reopening;
      await remote.send(message);
    }
  };

  local.onmessage = (message) => {
    forward(message).catch((error: Error) => {
      if (!isJSONRPCRequest(message)) return;
      void local.send({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: `${BRIDGE_DOWN} (${error.message})` } });
    });
  };
  local.onclose = () => void remote.close().catch(() => {});

  await open();
  await local.start();
}
