import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { TokenFile } from '../../src/adapters/token-file.js';

describe('TokenFile', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agent-bridge-'));
    path = join(dir, 'sub', 'tokens.json');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('starts empty without a file', () => {
    assert.deepEqual(new TokenFile(path).load(), {});
  });

  it('saves and loads again, creating the folder if missing', () => {
    const tokens = { 'http://localhost:4200': ['abc', 'def'] };
    new TokenFile(path).save(tokens);
    assert.deepEqual(new TokenFile(path).load(), tokens);
  });

  it('starts empty with a broken or malformed file', () => {
    const file = new TokenFile(path);
    file.save({});
    writeFileSync(path, '{broken');
    assert.deepEqual(file.load(), {});
    writeFileSync(path, JSON.stringify({ 'http://localhost:4200': 'abc' }));
    assert.deepEqual(file.load(), {});
  });
});
