import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { download, type Fetch } from '../../src/download.js';

const body = Buffer.from('a fake model');
const sha256 = createHash('sha256').update(body).digest('hex');
const fake = (data = body): Fetch & { calls: number } => {
  const f = Object.assign(async () => (f.calls++, { ok: true, status: 200, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.length) }), { calls: 0 });
  return f as Fetch & { calls: number };
};

describe('download', () => {
  it('stores the file when size and hash match, and does not download it again', async () => {
    const dest = join(mkdtempSync(join(tmpdir(), 'dl-')), 'a', 'model.onnx');
    const fetchImpl = fake();
    await download('https://x/model.onnx', dest, { sha256, size: body.length }, fetchImpl);
    assert.deepEqual(readFileSync(dest), body);
    await download('https://x/model.onnx', dest, { sha256 }, fetchImpl);
    assert.equal(fetchImpl.calls, 1);
  });

  it('fails and leaves nothing on disk when the hash does not match', async () => {
    const dest = join(mkdtempSync(join(tmpdir(), 'dl-')), 'model.onnx');
    await assert.rejects(download('https://x/model.onnx', dest, { sha256 }, fake(Buffer.from('altered'))), /sha256 hash mismatch/);
    assert.equal(existsSync(dest), false);
    assert.equal(existsSync(dest + '.part'), false);
  });

  it('also checks md5 and size (the Piper catalog hashes)', async () => {
    const dest = join(mkdtempSync(join(tmpdir(), 'dl-')), 'voice.onnx');
    const md5 = createHash('md5').update(body).digest('hex');
    await assert.rejects(download('https://x/v', dest, { md5, size: 1 }, fake()), /size/);
    await download('https://x/v', dest, { md5, size: body.length }, fake());
    assert.ok(existsSync(dest));
  });
});
