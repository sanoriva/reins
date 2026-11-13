import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { Tokens, TokenStore } from '../core/index.js';

/** Stores the pairing tokens in a JSON file only the user can read. */
export class TokenFile implements TokenStore {
  constructor(private readonly path: string) {}

  /** Starts empty when the file is missing or broken. */
  load(): Tokens {
    try {
      const data: unknown = JSON.parse(readFileSync(this.path, 'utf8'));
      return isTokens(data) ? data : {};
    } catch {
      return {};
    }
  }

  /** Writes the tokens readable only by their owner: folder 0700, file 0600, also when the file already existed. */
  save(tokens: Tokens): void {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    writeFileSync(this.path, JSON.stringify(tokens, null, 2), { mode: 0o600 });
    chmodSync(this.path, 0o600);
  }
}

function isTokens(data: unknown): data is Tokens {
  return (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    Object.values(data).every((list) => Array.isArray(list) && list.every((token) => typeof token === 'string'))
  );
}
