import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chimeCommand, createSpeaker, pcmLevels, piperCommands, type SpeakCommand, speakCommand, speechQueue } from '../../src/speak.js';

describe('speakCommand', () => {
  /** The text never goes inside the script. */
  it('uses System.Speech on Windows, with the text and the language in environment variables', () => {
    const text = 'You are on Home"; Remove-Item C:\\ -Recurse; "';
    const command = speakCommand('win32', text, 'es');
    assert.equal(command.command, 'powershell');
    assert.deepEqual(command.env, { SANORIVA_TEXT: text, SANORIVA_LANG: 'es' });
    assert.equal(command.args.join(' ').includes('Remove-Item'), false);
    assert.match(command.args.at(-1)!, /System\.Speech/);
  });

  it('uses say on macOS and espeak-ng with the language on Linux', () => {
    assert.deepEqual(speakCommand('darwin', 'Hello'), { command: 'say', args: ['-f', '-'], input: 'Hello' });
    assert.deepEqual(speakCommand('linux', 'Hello', 'es'), { command: 'espeak-ng', args: ['-v', 'es', '--stdin'], input: 'Hello' });
    /** A text starting with '-' must never become an option. */
    for (const p of ['darwin', 'linux'] as const) assert.equal(speakCommand(p, '-w/home/u/.bashrc').args.includes('-w/home/u/.bashrc'), false);
  });
});

describe('piperCommands', () => {
  it('Piper generates raw PCM and ffplay plays it at its sample rate, with no window', () => {
    const { synth, player } = piperCommands({ piper: 'piper', model: 'es.onnx', sampleRate: 22050, ffplay: 'ffplay' });
    assert.deepEqual(synth, { command: 'piper', args: ['--model', 'es.onnx', '--output-raw'] });
    assert.equal(player.command, 'ffplay');
    for (const arg of ['-nodisp', '-autoexit', 's16le', '22050', 'mono']) assert.ok(player.args.includes(arg), arg);
    assert.equal(player.args.at(-1), '-');
  });
});

describe('createSpeaker', () => {
  it('the language of each sentence overrides the default', async () => {
    const ran: SpeakCommand[] = [];
    const speak = createSpeaker({ lang: 'es', platform: 'linux', run: async (c) => void ran.push(c) });
    await speak('Hello', 'en');
    assert.deepEqual(ran, [{ command: 'espeak-ng', args: ['-v', 'en', '--stdin'], input: 'Hello' }]);
  });

  it('runs the command for its system with its language', async () => {
    const ran: SpeakCommand[] = [];
    const speak = createSpeaker({ lang: 'es', platform: 'linux', run: async (c) => void ran.push(c) });
    await speak('Hello');
    assert.deepEqual(ran, [{ command: 'espeak-ng', args: ['-v', 'es', '--stdin'], input: 'Hello' }]);
  });
});

describe('speaking without blocking', () => {
  it('returns at once and sentences play in order, one after another', async () => {
    const log: string[] = [];
    let finish: () => void = () => {};
    const say = speechQueue((text) => new Promise<void>((resolve) => (log.push(`empieza ${text}`), (finish = () => (log.push(`acaba ${text}`), resolve())))));
    const first = say('uno');
    const second = say('dos');
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(log, ['empieza uno']);
    finish();
    await first;
    await new Promise((r) => setImmediate(r));
    finish();
    await second;
    assert.deepEqual(log, ['empieza uno', 'acaba uno', 'empieza dos', 'acaba dos']);
  });

  it('reports a failing sentence and still plays the next one', async () => {
    const errors: string[] = [];
    const said: string[] = [];
    const say = speechQueue(async (text) => {
      if (text === 'bad') throw new Error('no speaker');
      said.push(text);
    }, (error) => errors.push(error.message));
    void say('bad');
    await say('good');
    assert.deepEqual({ errors, said }, { errors: ['no speaker'], said: ['good'] });
  });

  it('ffplay generates the "I heard you" tone, with no files or window', () => {
    const { command, args } = chimeCommand('ffplay');
    assert.equal(command, 'ffplay');
    assert.ok(args.includes('-nodisp') && args.includes('lavfi'));
  });
});

describe('cutting the voice off', () => {
  /** The cut one and the waiting one: neither played whole. */
  it('cancel stops what plays (its signal aborts) and drops what was waiting; new sentences play', async () => {
    const started: string[] = [];
    let firstSignal: AbortSignal | undefined;
    const say = speechQueue(
      (text, _language, signal) =>
        new Promise<void>((resolve) => {
          started.push(text);
          if (text === 'uno') firstSignal = signal;
          signal?.addEventListener('abort', () => resolve());
          if (text !== 'uno') resolve();
        }),
    );
    const one = say('uno');
    const two = say('dos');
    await new Promise((r) => setImmediate(r));
    say.cancel();
    assert.deepEqual(await Promise.all([one, two]), [false, false]);
    assert.equal(firstSignal?.aborted, true);
    assert.equal(await say('tres'), true);
    assert.deepEqual(started, ['uno', 'tres']);
  });

  /** 60 samples at 1000 Hz: two 30 ms chunks. The first one at half level. */
  it('measures the level of each 30 ms chunk and the time it will play (not when it arrives)', () => {
    const levels: { level: number; at: number; first: boolean }[] = [];
    const feed = pcmLevels(1000, (level, at, first) => levels.push({ level, at, first }));
    const pcm = Buffer.alloc(60 * 2);
    for (let i = 0; i < 30; i++) pcm.writeInt16LE(16_384, i * 2);
    feed(pcm, 10_000);
    assert.equal(levels.length, 2);
    assert.ok(Math.abs(levels[0]!.level - 0.5) < 0.01);
    assert.equal(levels[1]!.level, 0);
    assert.deepEqual(levels.map((l) => [l.at, l.first]), [[10_300, true], [10_330, false]]);
  });
});
