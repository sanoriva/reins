import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runSetup } from '../../src/setup.js';

describe('runSetup', () => {
  it('runs every step even if one fails, reports each one and whether all succeeded', async () => {
    const lines: string[] = [];
    const ok = await runSetup(
      [
        { name: 'ffmpeg', run: async () => 'ffmpeg version 7' },
        { name: 'ffplay', run: async () => { throw new Error('ffplay not found: install it'); } },
        { name: 'Whisper', run: async () => 'descargado' },
      ],
      (line) => lines.push(line),
    );
    assert.equal(ok, false);
    assert.equal(lines.length, 3);
    assert.match(lines[0]!, /^✓ ffmpeg: ffmpeg version 7/);
    assert.equal(lines[1], '✗ ffplay: ffplay not found: install it');
    assert.match(lines[2]!, /^✓ Whisper: descargado/);
  });

  it('everything in place: true', async () => {
    assert.equal(await runSetup([{ name: 'x', run: async () => 'ok' }], () => {}), true);
  });
});
