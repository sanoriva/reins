import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

export const HOST = '127.0.0.1';
export const DEFAULT_PORT = 7420;

export interface BridgeConfig {
  port: number;
  allowedOrigins: string[];
  tokensFile: string;
  keyFile: string;
  command: BridgeCommand;
}

/** `stdio` relays MCP between an AI that starts it and the running bridge, adding the key. */
export type BridgeCommand = 'serve' | 'stdio' | 'print-key';
const OTHER_COMMANDS = ['stdio', 'print-key'] as const;

/**
 * Parses the command line: `--port` and one or more `--allow-origin`. Throws an Error with the reason when an
 * argument is invalid.
 *
 * @example
 * parseConfig(['--allow-origin', 'http://localhost:4200', '--port', '7420']);
 */
export function parseConfig(args: string[]): BridgeConfig {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: 'string' },
      'print-key': { type: 'boolean' },
      stdio: { type: 'boolean' },
      'allow-origin': { type: 'string', multiple: true },
    },
  });

  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${values.port}`);
  }

  const dir = join(homedir(), '.sanoriva-agent');
  const files = { tokensFile: join(dir, 'tokens.json'), keyFile: join(dir, 'bridge-key') };
  const command = OTHER_COMMANDS.find((name) => values[name]);
  if (command) return { port, allowedOrigins: [], ...files, command };

  const allowedOrigins = values['allow-origin'] ?? [];
  if (allowedOrigins.length === 0) {
    throw new Error('Missing --allow-origin: tell which website may connect, e.g. --allow-origin http://localhost:4200');
  }
  for (const origin of allowedOrigins) {
    if (!isOrigin(origin)) throw new Error(`Invalid origin: ${origin} (example: https://example.com)`);
  }

  return { port, allowedOrigins, ...files, command: 'serve' };
}

/** An origin is scheme + host + port, with no path. */
function isOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}
