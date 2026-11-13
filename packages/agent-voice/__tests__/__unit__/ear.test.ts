import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { ECHO_WINDOW_MS, Ear, IDLE_CLOSE_MS, INTERRUPTED, SETTLE_MS } from '../../src/ear.js';
import type { Mic } from '../../src/mic.js';
import { ENROLL_SENTENCES, Voiceprint } from '../../src/voiceprint.js';
import { pcm, silence, voice } from '../audio.fixture.js';

/** A fake microphone: the test decides what it "hears". Counts how many times it opens. */
function fakeMic() {
  const state = {
    opened: 0,
    data: undefined as ((chunk: Buffer) => void) | undefined,
    exit: undefined as ((reason: string) => void) | undefined,
  };
  const open = (): Mic => {
    state.opened++;
    return { onData: (l) => (state.data = l), onExit: (l) => (state.exit = l), stop: () => {} };
  };
  return { state, open, play: (chunk: Buffer) => state.data?.(chunk) };
}

/** Like fakeMic, but records when the microphone closes. */
function closableMic() {
  const mic = { stops: 0, data: undefined as ((chunk: Buffer) => void) | undefined, opened: 0 };
  const open = (): Mic => {
    mic.opened++;
    return { onData: (l) => (mic.data = l), onExit: () => {}, stop: () => void mic.stops++ };
  };
  return { mic, open, play: (chunk: Buffer) => mic.data?.(chunk) };
}

/** A fake Whisper: returns the sentences in order. */
const transcriber = (...texts: string[]) => ({ transcribe: async () => texts.shift() ?? '' });

/** A whole sentence: silence, voice and the 1.5 s pause that closes it. */
const phrase = () => pcm([...silence(20), ...voice(20), ...silence(50)]);
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('Ear', () => {
  it('opens the microphone on the first listen and returns the sentence after the pause', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('which page am I on?') });
    const next = ear.next();
    assert.equal(mic.state.opened, 1);
    mic.play(phrase());
    assert.equal(await next, 'which page am I on?');
  });

  /** The AI has not called listen again yet. */
  it('keeps what is said while the AI thinks and returns it on the next listen', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('the code is 3 5 7', '0 9 2') });
    const first = ear.next();
    mic.play(phrase());
    assert.equal(await first, 'the code is 3 5 7');
    mic.play(phrase());
    await flush();
    assert.equal(await ear.next(), '0 9 2');
    assert.equal(mic.state.opened, 1);
  });

  /**
   * First part: being transcribed. And the user keeps talking. The transcription starts on the next loop tick. Now it
   * ends.
   */
  it('does not answer in pieces: waits for the user to finish and returns it all together', async () => {
    const mic = fakeMic();
    let release: () => void = () => {};
    let first = true;
    const ear = new Ear({
      openMic: mic.open,
      transcriber: {
        transcribe: () =>
          first
            ? ((first = false), new Promise<string>((resolve) => (release = () => resolve('and what does'))))
            : Promise.resolve('the library offer'),
      },
    });
    let done = false;
    const next = ear.next().then((text) => ((done = true), text));
    mic.play(phrase());
    mic.play(pcm([...silence(5), ...voice(10)]));
    await flush();
    release();
    await flush();
    assert.equal(done, false);
    mic.play(pcm(silence(50)));
    assert.equal(await next, 'and what does the library offer');
  });

  /** Talking over it counts as an interruption. */
  it('also listens while the AI talks, so the user can answer or interrupt', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('no, stop, I want something else') });
    const next = ear.next();
    ear.saying('You are on the home page and I can read you the content');
    mic.play(phrase());
    assert.equal(await next, `${INTERRUPTED} no, stop, I want something else`);
  });
});

describe('Ear: the AI echo', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'Date'] }));
  afterEach(() => mock.timers.reset());

  /** Echo. A short "yes" is never echo. The user. */
  it('drops what repeats what the AI just said, and lets the user through', async () => {
    const mic = fakeMic();
    const ear = new Ear({
      openMic: mic.open,
      transcriber: transcriber('you are on the home page', 'yes', 'take me to my articles'),
    });
    const done = ear.saying('You are on the home page.');
    done();
    const next = ear.next(30_000);
    mic.play(phrase());
    mic.play(phrase());
    mic.play(phrase());
    await flush();
    await flush();
    assert.equal(await next, 'yes take me to my articles');
  });

  it('after a while it is no longer considered echo', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('you are on the home page') });
    ear.saying('You are on the home page.')();
    mock.timers.tick(ECHO_WINDOW_MS);
    const next = ear.next(30_000);
    mic.play(phrase());
    assert.equal(await next, 'you are on the home page');
  });
});

describe('Ear: the microphone does not stay open', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  /** Already closed: not heard. */
  it('closes by itself if the AI does not listen again within 30 s, and what is said afterwards is lost', async () => {
    const m = closableMic();
    const ear = new Ear({ openMic: m.open, transcriber: transcriber('hello', 'another conversation') });
    const first = ear.next();
    m.play(phrase());
    assert.equal(await first, 'hello');
    mock.timers.tick(IDLE_CLOSE_MS);
    assert.equal(m.mic.stops, 1);
    m.play(phrase());
    await flush();
    const next = ear.next(1000);
    assert.equal(m.mic.opened, 2);
    mock.timers.tick(1000);
    assert.equal(await next, '');
  });

  it('stop closes the microphone and drops anything pending, including what was being transcribed', async () => {
    const m = closableMic();
    let release: (text: string) => void = () => {};
    const ear = new Ear({ openMic: m.open, transcriber: { transcribe: () => new Promise<string>((r) => (release = r)) } });
    void ear.next(1000).catch(() => {});
    m.play(phrase());
    await flush();
    ear.stop();
    release('algo privado');
    await flush();
    assert.equal(m.mic.stops, 1);
    const next = ear.next(1000);
    mock.timers.tick(1000);
    assert.equal(await next, '');
  });
});

describe('Ear: Whisper hallucinations', () => {
  it('drops an endlessly repeated word', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber(Array(20).fill('yes').join(', '), 'ok') });
    const next = ear.next();
    mic.play(phrase());
    mic.play(phrase());
    assert.equal(await next, 'ok');
  });
});

describe('Ear: waiting and failures', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  /** The AI echo from the speakers. The AI stops talking and the user answers at once, with no pause. */
  it('closes the AI echo when it stops talking, so what the user says next arrives whole', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('hi i am listening what do you want to do', 'take me to my front page') });
    const next = ear.next();
    const done = ear.saying('Hi, I am listening. What do you want to do?');
    mic.play(pcm([...silence(20), ...voice(30)]));
    done();
    mic.play(pcm([...voice(30), ...silence(50)]));
    assert.equal(await next, 'take me to my front page');
  });

  it('does not transcribe a single knock (Whisper would make something up)', async () => {
    const mic = fakeMic();
    let calls = 0;
    const ear = new Ear({ openMic: mic.open, transcriber: { transcribe: async () => (calls++, 'anything?') } });
    const next = ear.next(500);
    mic.play(pcm([...silence(20), ...voice(5), ...silence(50)]));
    await flush();
    assert.equal(calls, 0);
    mock.timers.tick(500);
    assert.equal(await next, '');
  });

  /** The first "sentence" is noise; the second, voice. */
  it('what is not human voice (according to the detector) does not reach Whisper', async () => {
    const mic = fakeMic();
    let transcribed = 0;
    const verdicts = [false, true];
    const ear = new Ear({
      openMic: mic.open,
      transcriber: { transcribe: async () => (transcribed++, 'ok, take me to my front page') },
      speechCheck: { hasSpeech: async () => verdicts.shift() ?? true },
    });
    const next = ear.next();
    mic.play(phrase());
    mic.play(phrase());
    assert.equal(await next, 'ok, take me to my front page');
    assert.equal(transcribed, 1);
  });

  it('once it knows the user voice, another voice does not reach Whisper', async () => {
    const mic = fakeMic();
    let transcribed = 0;
    const embeddings = [[0, 0, 1], [1, 0, 0]];
    const ear = new Ear({
      openMic: mic.open,
      transcriber: { transcribe: async () => (transcribed++, 'book an appointment') },
      speaker: { embed: async () => Float32Array.from(embeddings.shift()!) },
      voiceprint: new Voiceprint({ load: () => ({ embedding: [1, 0, 0], sentences: ENROLL_SENTENCES }), save: () => {} }),
    });
    const next = ear.next();
    const longPhrase = () => pcm([...silence(20), ...voice(40), ...silence(50)]);
    mic.play(longPhrase());
    mic.play(longPhrase());
    assert.equal(await next, 'book an appointment');
    assert.equal(transcribed, 1);
  });

  it('returns empty when nobody talks within the wait time', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber() });
    const next = ear.next(1000);
    mic.play(pcm(silence(10)));
    mock.timers.tick(1000);
    assert.equal(await next, '');
  });

  it('reports a closed microphone and the next listen opens it again', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber() });
    const next = ear.next(1000);
    mic.state.exit?.('Could not find audio device');
    await assert.rejects(next, /Cannot use the microphone: Could not find audio device/);
    void ear.next(1000);
    assert.equal(mic.state.opened, 2);
    mock.timers.tick(1000);
  });
});

describe('Ear: endless background voice (a TV, a video)', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'Date'] }));
  afterEach(() => mock.timers.reset());

  /** And someone keeps talking in the background, with no pause. */
  it('with something already understood, does not wait for the TV to stop: returns within a few seconds', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('hello, can you hear me?') });
    let done = false;
    const next = ear.next().then((text) => ((done = true), text));
    mic.play(phrase());
    mic.play(pcm(voice(30)));
    await flush();
    await flush();
    assert.equal(done, false);
    mock.timers.tick(SETTLE_MS);
    assert.equal(await next, 'hello, can you hear me?');
  });

  it('returns whatever there is after 60 s even if voice keeps playing', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber() });
    const next = ear.next(1000);
    mic.play(pcm([...silence(20), ...voice(30)]));
    mock.timers.tick(1000);
    assert.equal(await next, '');
  });

  it('another tool ends the waiting listen, and what was heard is kept for the next one', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('take me to my appointments') });
    const first = ear.next();
    ear.interrupt();
    assert.equal(await first, '');
    mic.play(phrase());
    assert.equal(await ear.next(), 'take me to my appointments');
  });
});

describe('Ear: end of turn with Smart Turn', () => {
  const pauseThenWait = () => pcm([...silence(20), ...voice(40), ...silence(12)]);

  it('closes the sentence after 0.3 s of silence when Smart Turn says the user finished', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('book me an appointment'), turnCheck: { complete: async () => 0.9 } });
    const next = ear.next();
    mic.play(pauseThenWait());
    assert.equal(await next, 'book me an appointment');
  });

  it('waits for the long silence when it is only a pause', async () => {
    const mic = fakeMic();
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('book me a dermatology appointment'), turnCheck: { complete: async () => 0.1 } });
    let done = false;
    const next = ear.next().then((text) => ((done = true), text));
    mic.play(pauseThenWait());
    await flush();
    await flush();
    assert.equal(done, false);
    mic.play(pcm(silence(50)));
    assert.equal(await next, 'book me a dermatology appointment');
  });

  /** Sigue hablando. */
  it('does not close when the user talks again before the answer', async () => {
    const mic = fakeMic();
    let answer: (p: number) => void = () => {};
    const ear = new Ear({
      openMic: mic.open,
      transcriber: transcriber('I want an appointment for Monday'),
      turnCheck: { complete: () => new Promise<number>((resolve) => (answer = resolve)) },
    });
    let done = false;
    const next = ear.next().then((text) => ((done = true), text));
    mic.play(pauseThenWait());
    mic.play(pcm(voice(10)));
    answer(0.9);
    await flush();
    assert.equal(done, false);
    mic.play(pcm(silence(50)));
    assert.equal(await next, 'I want an appointment for Monday');
  });

  it('does not ask Smart Turn with under 1 s of voice, so a short question is not split', async () => {
    const mic = fakeMic();
    let asked = 0;
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('hello'), turnCheck: { complete: async () => (asked++, 0.9) } });
    const next = ear.next();
    mic.play(pcm([...silence(20), ...voice(20), ...silence(50)]));
    assert.equal(await next, 'hello');
    assert.equal(asked, 0);
  });

  it('does not ask Smart Turn while the AI talks (what is heard is its echo)', async () => {
    const mic = fakeMic();
    let asked = 0;
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber(), turnCheck: { complete: async () => (asked++, 0.9) } });
    void ear.next();
    ear.saying('Let me find you a dermatology appointment for next week');
    mic.play(pauseThenWait());
    await flush();
    assert.equal(asked, 0);
    ear.stop();
  });

  /** The AI echo. */
  it('calls onPhrase when a sentence closes while the AI listens, not while it talks', async () => {
    const mic = fakeMic();
    let chimes = 0;
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('hello', 'ok'), onPhrase: () => void chimes++ });
    const first = ear.next();
    mic.play(phrase());
    assert.equal(await first, 'hello');
    assert.equal(chimes, 1);
    const done = ear.saying('Hello, what do you want to do?');
    const second = ear.next();
    mic.play(phrase());
    done();
    await flush();
    assert.equal(chimes, 1);
    ear.stop();
    await second;
  });
});

describe('Ear: the user cuts the AI off', () => {
  /** The AI voice was cut off: its end does not close the user sentence. */
  it('talking over the AI silences it, the user sentence arrives whole and listen says it was interrupted', async () => {
    const mic = fakeMic();
    let cuts = 0;
    let calls = 0;
    const ear = new Ear({ openMic: mic.open, transcriber: { transcribe: async () => (calls++, 'stop, stop, that is not it') }, onBargeIn: () => void cuts++ });
    const next = ear.next();
    const done = ear.saying('Here are your appointments: on Saturday you have family medicine');
    const now = Date.now();
    for (let at = now - 1000; at < now + 5000; at += 30) ear.playing(0.05, at, at === now - 1000);
    mic.play(pcm([...silence(20), ...voice(20)]));
    assert.equal(cuts, 1);
    done();
    mic.play(pcm([...voice(10), ...silence(50)]));
    assert.equal(await next, `${INTERRUPTED} stop, stop, that is not it`);
    assert.equal(calls, 1);
  });
});

describe('Ear: cutting the AI off by what the user says', () => {
  /** The user's "stop", without the level detector firing (what plays is unknown) */
  it('a sentence that started while the AI talked and is not its echo is the user: it cuts the AI off and listen says so', async () => {
    const mic = fakeMic();
    let cuts = 0;
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('stop stop stop'), onBargeIn: () => void cuts++ });
    void ear.next().then(() => {});
    ear.interrupt();
    ear.saying('Fasting glucose: 112. Normal is 70 to 100.');
    ear.saying('Glycated haemoglobin: 6.8 percent.');
    mic.play(phrase());
    await flush();
    await flush();
    assert.equal(cuts, 1);
    assert.equal(await ear.next(), `${INTERRUPTED} stop stop stop`);
  });

  it('drops a short echo leftover ("of the") that started while the AI talked', async () => {
    const mic = fakeMic();
    let cuts = 0;
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('of the'), onBargeIn: () => void cuts++ });
    void ear.next();
    const done = ear.saying('LDL cholesterol is lower than in the last test of the year');
    mic.play(pcm([...silence(20), ...voice(20)]));
    done();
    await flush();
    await flush();
    assert.equal(cuts, 0);
    ear.stop();
  });
});

describe('Ear: short echo leftovers', () => {
  /** 0.36 s of voice: its echo. */
  it('a chunk with little voice that started while the AI talked does not cut it off, even if Whisper transcribes other words', async () => {
    const mic = fakeMic();
    let cuts = 0;
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('of the'), onBargeIn: () => void cuts++ });
    void ear.next();
    const done = ear.saying('OK, let me show you around. First, your appointments.');
    mic.play(pcm([...silence(20), ...voice(12), ...silence(50)]));
    done();
    await flush();
    await flush();
    assert.equal(cuts, 0);
    ear.stop();
  });

  /** 0.6 s of voice in 2.4 s: 25 %. */
  it('two words in a long chunk with little voice do not cut it off either, even past half a second of voice', async () => {
    const mic = fakeMic();
    let cuts = 0;
    const ear = new Ear({ openMic: mic.open, transcriber: transcriber('of the'), onBargeIn: () => void cuts++ });
    void ear.next();
    const done = ear.saying('Booked: nursing on Wednesday 18 at nine.');
    mic.play(pcm([...silence(20), ...voice(20), ...silence(50)]));
    done();
    await flush();
    await flush();
    assert.equal(cuts, 0);
    ear.stop();
  });
});
