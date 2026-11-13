import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FRAME_SAMPLES, VoiceDetector } from '../../src/vad.js';
import { frame, silence, voice } from '../audio.fixture.js';

const run = (detector: VoiceDetector, frames: Float32Array[]) => frames.map((f) => detector.push(f)).at(-1);

describe('VoiceDetector', () => {
  it('keeps waiting with only background noise', () => {
    assert.equal(run(new VoiceDetector(), silence(200)), 'waiting');
  });

  it('detects the start of speech and its end after 1.5 s of silence', () => {
    const detector = new VoiceDetector();
    run(detector, silence(20));
    assert.equal(run(detector, voice(3)), 'speaking');
    assert.equal(run(detector, voice(30)), 'speaking');
    assert.equal(run(detector, silence(49)), 'speaking');
    assert.equal(run(detector, silence(1)), 'done');
  });

  it('a 1 s pause inside a sentence does not split it', () => {
    const detector = new VoiceDetector();
    run(detector, [...silence(20), ...voice(20), ...silence(33)]);
    assert.equal(run(detector, voice(5)), 'speaking');
  });

  it('a single knock (under 90 ms) does not count as voice', () => {
    const detector = new VoiceDetector();
    assert.equal(run(detector, [...silence(20), ...voice(2), ...silence(5)]), 'waiting');
  });

  /** 10 from before (including the first 3 voice blocks that trigger detection) + 7 of voice + 50 of silence. */
  it('the sentence includes 0.3 s before the start, so the first syllable is not cut', () => {
    const detector = new VoiceDetector();
    run(detector, [...silence(20), ...voice(10), ...silence(50)]);
    assert.equal(detector.utterance().length, (10 + 7 + 50) * FRAME_SAMPLES);
  });

  const startsAt = (frames: Float32Array[], detector = new VoiceDetector()) => frames.findIndex((f) => detector.push(f) === 'speaking');
  const level = (amplitude: number, count: number) => Array.from({ length: count }, () => frame(amplitude));
  /** Real speech: syllables with short pauses in between (240 ms of voice, 60 ms of pause). */
  const talk = (amplitude: number, count: number, pause = 0.003) =>
    Array.from({ length: count }, (_, i) => frame(i % 10 < 8 ? amplitude : pause));

  it('hears the user even if they are already talking when listening starts', () => {
    assert.ok(startsAt(talk(0.05, 60)) >= 0);
  });

  it('hears the user right after a loud AI echo', () => {
    assert.ok(startsAt([...talk(0.08, 20), ...talk(0.05, 60)]) >= 0);
  });

  /** Noise alone is not voice. */
  it('hears a normal voice over background noise', () => {
    const detector = new VoiceDetector();
    assert.equal(startsAt(level(0.02, 400), detector), -1);
    assert.ok(startsAt(talk(0.05, 30, 0.02), detector) >= 0);
  });

  it('hears a voice that starts soft and gets louder', () => {
    const rising = Array.from({ length: 33 }, (_, i) => frame(0.01 + i * 0.0015));
    assert.ok(startsAt([...rising, ...level(0.06, 30)]) >= 0);
  });

  it('the noise level lasts the whole conversation: after one sentence, the next is heard the same', () => {
    const detector = new VoiceDetector();
    run(detector, [...level(0.02, 400), ...talk(0.06, 30, 0.02), ...level(0.02, 50)]);
    assert.equal(detector.current, 'done');
    detector.next();
    assert.ok(startsAt(talk(0.06, 30, 0.02), detector) >= 0);
  });

  it('measures how much real voice the sentence had', () => {
    const detector = new VoiceDetector();
    run(detector, [...silence(20), ...voice(20), ...silence(50)]);
    assert.equal(detector.voicedMs, 20 * 30);
  });

  it('cuts a sentence longer than 20 s', () => {
    const detector = new VoiceDetector({ maxFrames: 50 });
    run(detector, silence(20));
    assert.equal(run(detector, voice(60)), 'done');
  });

  /** Calibration. A minute of AI echo. The same sound without the AI talking does count as noise. */
  it('does not learn the AI echo as noise while it talks, so the user is still heard after a minute of reading', () => {
    const vad = new VoiceDetector();
    for (const f of silence(10)) vad.push(f);
    const before = vad.threshold;
    for (let i = 0; i < 2000; i++) if (vad.push(frame(0.05), false) === 'done') vad.next();
    assert.equal(vad.threshold, before);
    for (let i = 0; i < 2000; i++) if (vad.push(frame(0.05)) === 'done') vad.next();
    assert.ok(vad.threshold > before);
  });
});
