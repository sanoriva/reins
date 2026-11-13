import { appendFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Logs what happens to each sentence. Without --verbose it logs nothing. */
export type Log = (message: string) => void;

export const silent: Log = () => {};

/**
 * To stderr (stdout is the MCP channel) and to the file, with the time. The file holds what the user says, so only its
 * owner can read it: the folder is created 0700 and the file 0600, also when it already existed with looser
 * permissions. On Windows these modes have no effect; the user profile's permissions apply.
 */
export function fileLog(file: string): Log {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  if (existsSync(file)) chmodSync(file, 0o600);
  return (message) => {
    const line = `${new Date().toISOString().slice(11, 23)} ${message}`;
    console.error(line);
    appendFileSync(file, line + '\n', { mode: 0o600 });
  };
}
