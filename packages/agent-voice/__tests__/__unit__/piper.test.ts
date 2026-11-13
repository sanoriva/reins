import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { type Catalog, type CatalogVoice, chooseVoice, ensurePiper, ensureVoice } from '../../src/piper.js';

const voice = (key: string, code: string, quality: string): CatalogVoice => ({
  key,
  language: { code, family: code.split('_')[0]! },
  quality,
  files: { [`x/${key}.onnx`]: { size_bytes: 1, md5_digest: '' }, [`x/${key}.onnx.json`]: { size_bytes: 1, md5_digest: '' } },
});
const catalog: Catalog = Object.fromEntries(
  [
    voice('es_AR-daniela-high', 'es_AR', 'high'),
    voice('es_ES-sharvard-medium', 'es_ES', 'medium'),
    voice('es_ES-davefx-medium', 'es_ES', 'medium'),
    voice('es_MX-ald-x_low', 'es_MX', 'x_low'),
    voice('fr_FR-siwis-low', 'fr_FR', 'low'),
  ].map((v) => [v.key, v]),
);

describe('chooseVoice (from the catalog, no lists in the code)', () => {
  it('by family: the best quality and, on a tie, the first by name', () => {
    assert.equal(chooseVoice(catalog, 'es')?.key, 'es_ES-davefx-medium');
  });

  it('by exact variant when there is one (es_MX, es-AR)', () => {
    assert.equal(chooseVoice(catalog, 'es_MX')?.key, 'es_MX-ald-x_low');
    assert.equal(chooseVoice(catalog, 'es-AR')?.key, 'es_AR-daniela-high');
  });

  it('a missing variant falls back to its family', () => {
    assert.equal(chooseVoice(catalog, 'es_CO')?.key, 'es_ES-davefx-medium');
  });

  it('a language without voices gets nothing', () => {
    assert.equal(chooseVoice(catalog, 'xx'), undefined);
  });
});

describe('ensurePiper', () => {
  it('a platform without a Piper build says so (and suggests the system voice)', async () => {
    await assert.rejects(ensurePiper(tmpdir(), { platform: 'aix', arch: 'ppc64' }), /--tts system/);
  });
});

describe('ensureVoice', () => {
  it('downloads the model and its config and reads the sample rate', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'voices-'));
    const config = Buffer.from(JSON.stringify({ audio: { sample_rate: 16000 } }));
    const files = { 'es/v.onnx': Buffer.from('m'), 'es/v.onnx.json': config };
    const v: CatalogVoice = {
      key: 'v',
      language: { code: 'es_ES', family: 'es' },
      quality: 'medium',
      files: Object.fromEntries(Object.entries(files).map(([path, data]) => [path, { size_bytes: data.length, md5_digest: createHash('md5').update(data).digest('hex') }])),
    };
    writeFileSync(join(dir, 'x'), '');
    const fetchImpl = async (url: string) => {
      const data = Object.entries(files).find(([path]) => url.endsWith(path))![1];
      return { ok: true, status: 200, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.length) };
    };
    const { model, sampleRate } = await ensureVoice(dir, v, fetchImpl);
    assert.match(model, /v\.onnx$/);
    assert.equal(sampleRate, 16000);
  });
});
