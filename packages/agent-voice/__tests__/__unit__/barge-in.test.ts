import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EchoGate, LEARN_MS, MIN_USER_MS } from '../../src/barge-in.js';

const FLOOR = 0.01;

/** The AI plays at level 0.2 from t=0 for 5 s. */
function speakingGate() {
  const gate = new EchoGate();
  for (let at = 0; at < 5000; at += 30) gate.play(0.2, at, at === 0);
  return gate;
}

/** The microphone hears this level from `from` to `to`; returns whether it ever cut the AI off. */
function hear(gate: EchoGate, level: (t: number) => number, from: number, to: number): number | undefined {
  for (let t = from; t < to; t += 30) if (gate.mic(level(t), t, FLOOR)) return t;
  return undefined;
}

describe('EchoGate: is the user talking over the AI?', () => {
  /** 60 % of what plays comes back. */
  it('its own echo (what comes back from the speaker) never cuts it off, however loud', () => {
    const gate = speakingGate();
    assert.equal(hear(gate, () => 0.12, 0, 5000), undefined);
  });

  it('the user talking clearly louder than the echo cuts it off after about 200 ms', () => {
    const gate = speakingGate();
    const at = hear(gate, (t) => (t < 2000 ? 0.12 : 0.5), 0, 5000);
    assert.ok(at !== undefined && at >= 2000 + MIN_USER_MS - 60 && at <= 2000 + MIN_USER_MS + 30);
  });

  it('a single knock (under 200 ms) does not cut it off', () => {
    const gate = speakingGate();
    assert.equal(hear(gate, (t) => (t >= 2000 && t < 2090 ? 0.6 : 0.12), 0, 5000), undefined);
  });

  it('does not cut while learning the echo (the first half second)', () => {
    const gate = speakingGate();
    assert.equal(hear(gate, () => 0.5, 0, LEARN_MS), undefined);
  });

  it('never cuts without knowing what plays (e.g. with the system voice), since it could not tell its echo', () => {
    assert.equal(hear(new EchoGate(), () => 0.5, 0, 3000), undefined);
  });

  /** Learns the echo. Room noise. */
  it('between AI sentences (nothing playing), the user voice above the noise cuts it off', () => {
    const gate = speakingGate();
    hear(gate, () => 0.12, 0, 600);
    assert.ok(hear(gate, () => 0.3, 6000, 7000) !== undefined);
    assert.equal(hear(gate, () => 0.005, 8000, 9000), undefined);
  });
});
