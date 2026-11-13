import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_PORT, parseConfig } from '../../src/config.js';

describe('parseConfig', () => {
  it('defaults to port 7420 and accepts several origins', () => {
    const config = parseConfig(['--allow-origin', 'http://localhost:4200', '--allow-origin', 'https://example.com']);
    assert.equal(config.port, DEFAULT_PORT);
    assert.deepEqual(config.allowedOrigins, ['http://localhost:4200', 'https://example.com']);
    assert.match(config.tokensFile, /\.sanoriva-agent[\\/]tokens\.json$/);
    assert.match(config.keyFile, /\.sanoriva-agent[\\/]bridge-key$/);
    assert.equal(config.command, 'serve');
  });

  it('--stdio and --print-key need no --allow-origin', () => {
    assert.equal(parseConfig(['--stdio']).command, 'stdio');
    assert.equal(parseConfig(['--print-key']).command, 'print-key');
  });

  it('accepts another port', () => {
    assert.equal(parseConfig(['--port', '8000', '--allow-origin', 'http://localhost:4200']).port, 8000);
  });

  it('refuses to start without --allow-origin and says why', () => {
    assert.throws(() => parseConfig([]), /Missing --allow-origin/);
  });

  it('rejects invalid ports and origins', () => {
    assert.throws(() => parseConfig(['--port', 'abc', '--allow-origin', 'http://localhost:4200']), /Invalid port/);
    assert.throws(() => parseConfig(['--allow-origin', 'https://example.com/blog']), /Invalid origin/);
    assert.throws(() => parseConfig(['--allow-origin', 'example.com']), /Invalid origin/);
  });
});
