import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname } from 'node:path';

const KEY = /^[0-9a-f]{64}$/;

/** One key per bridge install, valid for every website, so one AI can drive any number of sites. */
export function loadOrCreateKey(path: string): string {
  try {
    const key = readFileSync(path, 'utf8').trim();
    if (KEY.test(key)) return key;
  } catch {}
  const key = randomBytes(32).toString('hex');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${key}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return key;
}
