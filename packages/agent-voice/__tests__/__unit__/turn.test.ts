import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { prepareTurnAudio } from '../../src/turn.js';

const SAMPLES = 8 * 16_000;

describe('Smart Turn: audio preparation', () => {
  /** The front is padding. */
  it('pads a short turn with leading zeros up to 8 s', () => {
    const audio = Float32Array.from({ length: 16_000 }, (_, i) => Math.sin(i / 5));
    const out = prepareTurnAudio(audio);
    assert.equal(out.length, SAMPLES);
    const firstValue = out[0]!;
    assert.ok(out.subarray(0, SAMPLES - audio.length).every((s) => s === firstValue));
  });

  /** The last second has sound. */
  it('keeps the last 8 s of a long turn', () => {
    const audio = new Float32Array(SAMPLES + 16_000);
    audio.fill(1, SAMPLES);
    const out = prepareTurnAudio(audio);
    assert.ok(out[SAMPLES - 1]! > out[0]!);
  });

  it('normalises to mean 0 and variance 1', () => {
    const out = prepareTurnAudio(Float32Array.from({ length: 32_000 }, (_, i) => 0.3 * Math.sin(i / 7) + 0.1));
    const mean = out.reduce((a, b) => a + b, 0) / out.length;
    const variance = out.reduce((a, b) => a + (b - mean) ** 2, 0) / out.length;
    assert.ok(Math.abs(mean) < 1e-4);
    assert.ok(Math.abs(variance - 1) < 1e-3);
  });
});
