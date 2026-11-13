import { type Log, silent } from './log.js';
import type { Mic, OpenMic } from './mic.js';
import type { SpeechCheck } from './speech-check.js';
import type { Transcriber } from './stt.js';
import { EchoGate } from './barge-in.js';
import { TURN_COMPLETE, type TurnCheck } from './turn.js';
import { FRAME_SAMPLES, type VadOptions, VoiceDetector } from './vad.js';
import type { SpeakerCheck } from './speaker.js';
import { MIN_JUDGE_MS, type Voiceprint } from './voiceprint.js';

export const MAX_WAIT_MS = 60_000;
/**
 * What the AI said may come back through the microphone (echo) up to this long after it finished saying it.
 */
export const ECHO_WINDOW_MS = 10_000;
/** A sentence is echo if at least this share of its words came from what the AI said… */
export const ECHO_OVERLAP = 0.7;
/** …and it has at least this many words (a user's "yes" or "ok" is never echo). */
export const ECHO_MIN_WORDS = 3;
/**
 * If the AI does not call listen again within this time, the conversation is over and the microphone closes.
 */
export const IDLE_CLOSE_MS = 30_000;
/** A "sentence" with less voice energy than this is a knock or a noise and is not transcribed. */
export const MIN_VOICED_MS = 300;
/**
 * With something already understood, listen waits at most this long for the speaker to stop (it may be a TV).
 */
export const SETTLE_MS = 3_000;
/**
 * At every 0.3 s pause (10 blocks) Smart Turn is asked whether the user has finished. If not, the 1.5 s limit
 * applies.
 */
export const PAUSE_FRAMES = 10;
/**
 * Smart Turn only closes a sentence early when it has at least this much voice, so it does not split a short
 * question in pieces.
 */
export const MIN_TURN_VOICED_MS = 1_000;
/**
 * When the user cuts the AI off, their sentence starts this much earlier (17 blocks, 0.5 s); what came before
 * was the AI.
 */
const BARGE_KEEP_FRAMES = 17;
/** The interruption is checked against the voiceprint on its last 1.2 s, the least mixed with the AI's echo. */
const BARGE_CHECK_SAMPLES = 19_200;
/**
 * A sentence that started while the AI was talking and is not its echo only cuts the AI off with at least
 * this much voice. Echo leftovers are chunks with little voice (330 ms in 3 s) that Whisper sometimes
 * transcribes as other words; a user saying "stop, stop" had 750 ms.
 */
export const MIN_INTERRUPT_VOICED_MS = 500;
/**
 * …and, under 3 words, it must be almost all voice. An echo leftover is a few words in a long chunk with
 * little voice (510 ms of voice in 3.4 s, 15 %); a single "stop" from the user is almost all voice.
 */
export const MIN_INTERRUPT_VOICE_RATIO = 0.3;

/**
 * Whether it is a leftover of the AI's echo, even if Whisper transcribed it with words the AI did not say.
 */
function echoLeftover(text: string, voicedMs: number, audioMs: number): boolean {
  const words = (text.match(/\p{L}+/gu) ?? []).length;
  return voicedMs < MIN_INTERRUPT_VOICED_MS || (words < 3 && voicedMs / audioMs < MIN_INTERRUPT_VOICE_RATIO);
}
/**
 * What listen returns when the user cut the AI off, so the AI knows the user did not hear everything it said.
 */
export const INTERRUPTED = '(the user interrupted you while you were speaking)';

const rms = (frame: Float32Array) => {
  let sum = 0;
  for (const sample of frame) sum += sample * sample;
  return Math.sqrt(sum / frame.length);
};

/** Whisper sometimes makes up an endlessly repeated word over noise or music ("yes, yes, yes…"). */
function isRepetition(text: string): boolean {
  const all = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  return all.length >= 8 && new Set(all).size / all.length < 0.25;
}

export interface EarOptions {
  openMic: OpenMic;
  transcriber: Transcriber;
  /**
   * Checks that a sentence has human voice before Whisper: over noise, Whisper makes up sentences (from the
   * subtitles it was trained on). Works for any language.
   */
  speechCheck?: SpeechCheck;
  vad?: VadOptions;
  /**
   * Decides whether a pause ends the turn (Smart Turn). With it, the sentence closes after 0.3 s of silence
   * if the user has finished; without it, always after 1.5 s.
   */
  turnCheck?: TurnCheck;
  /** A user sentence just closed while the AI listens, to let the user know they were heard. */
  onPhrase?: () => void;
  /** The user started talking while the AI talks: it must go quiet. */
  onBargeIn?: () => void;
  /** With both, sentences from other voices (a TV, someone nearby) are dropped and do not cut the AI off. */
  speaker?: SpeakerCheck;
  voiceprint?: Voiceprint;
  log?: Log;
}

interface Said {
  words: Set<string>;
  /** Until when it may come back as echo; Infinity while it is being said. */
  until: number;
  /** The user cut it off: when it ends, the current sentence is not closed, because it is the user's. */
  cut?: boolean;
}

/** Words without accents or capitals, to compare what was heard with what was said. */
function words(text: string): Set<string> {
  const plain = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return new Set(plain.match(/[a-z0-9ñ]+/g) ?? []);
}

/**
 * Continuous listening. The microphone stays open from the first listen, also while the AI talks, so the user
 * can answer or interrupt at once. Each long pause closes a sentence, which is transcribed and stored; listen
 * returns it whole. Whatever matches what the AI just said is its own echo from the speakers and is
 * discarded.
 */
export class Ear {
  private mic: Mic | undefined;
  private vad: VoiceDetector;
  private leftover = Buffer.alloc(0);
  /**
   * Understood text not collected by listen yet. `fromUser`: it started while the AI was quiet, so it is not
   * an echo leftover.
   */
  private heard: { text: string; fromUser: boolean }[] = [];
  private failure: string | undefined;
  private waiters: (() => void)[] = [];
  private transcribing = Promise.resolve();
  private pending = 0;
  private speaking = false;
  private said: Said[] = [];
  /** Bumped on close, so transcriptions in progress are discarded. */
  private generation = 0;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private heardAt = 0;
  /** Bumped on every interrupt, so the waiting listen returns. */
  private interrupts = 0;
  /** Bumped on every closed sentence, so a Smart Turn answer for a previous sentence is ignored. */
  private utteranceId = 0;
  /** Smart Turn is deciding: it is not asked again, since each pass delays Silero and Whisper. */
  private checkingTurn = false;
  private gate = new EchoGate();
  /** The microphone heard more than the AI's echo in this sentence; whether it is the user is still being checked. */
  private bargeSuspect = -1;
  private checkingVoice = false;
  private checkedVoiceMs = 0;
  /** The current sentence started while the AI was talking, so it is almost always its echo. */
  private startedWithAI = false;
  /** The user cut the AI off; the AI is told on the next listen. */
  private interruptedAI = false;

  constructor(private readonly options: EarOptions) {
    this.vad = new VoiceDetector(options.vad);
  }

  /**
   * Everything the user said since the last call, whole: waits for them to stop talking and for the rest to be
   * transcribed. It never gets stuck with endless background voice (a TV, a video): with something already understood,
   * it returns at most SETTLE_MS later, and after maxWaitMs it returns whatever there is (or nothing). Anything still
   * playing is not lost: it goes to the next listen.
   *
   * If another tool interrupts it, it returns without consuming what was heard, which is kept for the next listen. If
   * the AI does not listen again soon, the conversation is over and the microphone closes. The AI is told it was cut off
   * once, even if what cut it off never became a sentence.
   */
  async next(maxWaitMs = MAX_WAIT_MS): Promise<string> {
    clearTimeout(this.idleTimer);
    this.open();
    const interrupts = this.interrupts;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      this.wake();
    }, maxWaitMs);
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const busy = () => this.speaking || this.pending > 0;
    while (!this.failure && !timedOut && interrupts === this.interrupts) {
      if (this.heard.length) {
        const left = this.heardAt + SETTLE_MS - Date.now();
        if (!busy() || left <= 0) break;
        settleTimer ??= setTimeout(() => this.wake(), left);
      }
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    clearTimeout(timer);
    clearTimeout(settleTimer);
    if (interrupts !== this.interrupts) return '';
    this.idleTimer = setTimeout(() => this.stop(), IDLE_CLOSE_MS);
    if (this.failure) {
      const reason = this.failure;
      this.failure = undefined;
      throw new Error(reason);
    }
    let text = this.heard.map((h) => h.text).join(' ');
    this.heard = [];
    if (text && this.interruptedAI) text = `${INTERRUPTED} ${text}`;
    this.interruptedAI = false;
    return text;
  }

  /**
   * A 30 ms chunk about to play from the speaker (its level and when it plays). `first` starts a sentence.
   */
  playing(level: number, at: number, first = false): void {
    this.gate.play(level, at, first);
  }

  /**
   * The AI is about to say this text. Returns the function to call when it finishes: it closes the current
   * sentence, which is its echo from the speakers, so it does not merge with what the user says next (if they
   * merged, the echo filter would also discard the user's words).
   */
  saying(text: string): () => void {
    const said: Said = { words: words(text), until: Infinity };
    this.said.push(said);
    return () => {
      said.until = Math.max(Number.isFinite(said.until) ? said.until : 0, Date.now() + ECHO_WINDOW_MS);
      if (!said.cut && this.vad.current === 'speaking') this.endUtterance();
    };
  }

  /**
   * Another tool arrives (speak, stop or another listen): the waiting listen returns now, without consuming
   * what was heard. This way the AI can speak even if an earlier listen is still waiting.
   */
  interrupt(): void {
    this.interrupts++;
    this.wake();
  }

  /** Ends the conversation: closes the microphone and clears everything pending. */
  stop(): void {
    clearTimeout(this.idleTimer);
    this.mic?.stop();
    this.mic = undefined;
    this.generation++;
    this.utteranceId++;
    this.gate = new EchoGate();
    this.interruptedAI = false;
    this.heard = [];
    this.said = [];
    this.speaking = false;
    this.leftover = Buffer.alloc(0);
    this.vad = new VoiceDetector(this.options.vad);
    this.wake();
  }

  /** If the microphone closes by itself, the next listen opens it again. */
  private open(): void {
    if (this.mic) return;
    const mic = this.options.openMic();
    this.mic = mic;
    mic.onData((chunk) => this.onAudio(chunk));
    mic.onExit((reason) => {
      if (this.mic !== mic) return;
      this.mic = undefined;
      this.failure = `Cannot use the microphone: ${reason}`;
      this.wake();
    });
  }

  /**
   * No noise is learned while the AI talks: after a minute of reading, its echo passed for noise and the user's "stop"
   * no longer crossed the threshold.
   */
  private onAudio(chunk: Buffer): void {
    if (!this.mic) return;
    const bytes = Buffer.concat([this.leftover, chunk]);
    const frameBytes = FRAME_SAMPLES * 2;
    let offset = 0;
    for (; offset + frameBytes <= bytes.length; offset += frameBytes) {
      const frame = new Float32Array(FRAME_SAMPLES);
      for (let i = 0; i < FRAME_SAMPLES; i++) frame[i] = bytes.readInt16LE(offset + i * 2) / 32_768;
      if (this.aiSpeaking() && this.gate.mic(rms(frame), Date.now(), this.vad.threshold)) this.bargeSuspect = this.utteranceId;
      if (this.bargeSuspect === this.utteranceId && this.aiSpeaking()) this.maybeBargeIn();
      const was = this.speaking;
      const state = this.vad.push(frame, !this.aiSpeaking());
      this.speaking = state === 'speaking';
      if (this.speaking && !was) this.startedWithAI = this.aiSpeaking();
      if (state === 'done') this.endUtterance();
      else if (state === 'speaking' && this.vad.quietFrames === PAUSE_FRAMES) this.checkTurn();
    }
    this.leftover = bytes.subarray(offset);
  }

  /** With a learned voiceprint the AI only goes quiet for the user's voice, which needs about a second of it. */
  private maybeBargeIn(): void {
    const { speaker, voiceprint } = this.options;
    if (!speaker || !voiceprint?.ready) return this.bargeIn();
    if (this.checkingVoice || this.vad.voicedMs < MIN_JUDGE_MS || this.vad.voicedMs < this.checkedVoiceMs + 500) return;
    this.checkingVoice = true;
    this.checkedVoiceMs = this.vad.voicedMs;
    const id = this.utteranceId;
    const audio = this.vad.utterance();
    speaker
      .embed(audio.subarray(Math.max(0, audio.length - BARGE_CHECK_SAMPLES)))
      .then(
        (embedding) => {
          const { user, similarity } = voiceprint.judge(embedding, 0, false);
          this.log(`interruption: ${user ? 'your voice' : 'another voice'} (${similarity?.toFixed(2)})`);
          if (user && id === this.utteranceId && this.aiSpeaking()) this.bargeIn();
        },
        (error: Error) => this.log(`voice check failed: ${error.message}`),
      )
      .finally(() => (this.checkingVoice = false));
  }

  /**
   * The user talks over the AI: it goes quiet, and the user's sentence starts here (what came before was the AI's
   * voice, which the echo filter would discard along with the user's words).
   */
  private bargeIn(): void {
    this.log('the user is talking: cutting the AI off');
    for (const said of this.said) {
      if (said.until !== Infinity) continue;
      said.cut = true;
      said.until = Date.now() + ECHO_WINDOW_MS;
    }
    this.interruptedAI = true;
    this.startedWithAI = false;
    if (this.vad.current === 'speaking') this.vad.keepLast(BARGE_KEEP_FRAMES);
    this.options.onBargeIn?.();
  }

  /**
   * 0.3 s pause: Smart Turn tells whether the user has finished. If so and they are still quiet, the sentence closes
   * now instead of after 1.5 s. If they started talking again meanwhile, the answer is ignored. While the AI talks,
   * what is heard is almost always its echo: the sentence closes when it stops talking.
   */
  private checkTurn(): void {
    const turnCheck = this.options.turnCheck;
    if (!turnCheck || this.checkingTurn || this.vad.voicedMs < MIN_TURN_VOICED_MS || this.aiSpeaking()) return;
    this.checkingTurn = true;
    const id = this.utteranceId;
    const started = Date.now();
    turnCheck.complete(this.vad.utterance()).then(
      (probability) => {
        const still = id === this.utteranceId && this.vad.current === 'speaking' && this.vad.quietFrames >= PAUSE_FRAMES;
        const verdict = probability > TURN_COMPLETE ? 'finished' : 'just a pause';
        this.log(`Smart Turn: ${verdict} (${probability.toFixed(2)}, ${Date.now() - started} ms)${still ? '' : ' · outdated'}`);
        if (still && probability > TURN_COMPLETE) this.endUtterance();
      },
      (error: Error) => this.log(`Smart Turn failed: ${error.message}`),
    ).finally(() => (this.checkingTurn = false));
  }

  /** Closes the current sentence and prepares the next one; the detector keeps the room noise level. */
  private endUtterance(): void {
    const audio = this.vad.utterance();
    const voiced = this.vad.voicedMs;
    const fromUser = !this.startedWithAI;
    this.vad.next();
    this.utteranceId++;
    this.checkedVoiceMs = 0;
    this.speaking = false;
    const ms = Math.round((audio.length / 16_000) * 1000);
    if (voiced >= MIN_VOICED_MS) {
      this.log(`sentence closed: ${ms} ms of audio, ${voiced} ms of voice${this.aiSpeaking() ? ' (while the AI was talking)' : ''}`);
      if (this.waiters.length && !this.aiSpeaking()) this.options.onPhrase?.();
      this.transcribe(audio, fromUser, voiced, ms);
    } else {
      this.log(`stray noise dropped: ${ms} ms, ${voiced} ms of voice`);
      this.wake();
    }
  }

  private async isUser(audio: Float32Array, voiced: number, fromUser: boolean): Promise<boolean> {
    const { speaker, voiceprint } = this.options;
    if (!speaker || !voiceprint || voiced < MIN_JUDGE_MS) return true;
    const { user, similarity } = voiceprint.judge(await speaker.embed(audio), voiced, fromUser);
    const score = similarity === undefined ? '' : ` (${similarity.toFixed(2)})`;
    this.log(`${user ? 'your voice' : 'another voice: dropped'}${score}${voiceprint.ready ? '' : ' · still learning it'}`);
    return user;
  }

  private log(message: string): void {
    (this.options.log ?? silent)(`[ear] ${message}`);
  }

  private aiSpeaking(): boolean {
    return this.said.some((said) => said.until === Infinity);
  }

  /**
   * Sentences are transcribed in order, one after another. A sentence that started while the AI was talking is almost
   * always its echo, and is dropped if nearly all its words are the AI's, however short. If it is not the echo, the user
   * is talking over the AI (their "stop" was not in what the AI said): this is the second way to cut the AI off, in case
   * the microphone level check did not fire.
   */
  private transcribe(audio: Float32Array, fromUser: boolean, voiced = Infinity, audioMs = Infinity): void {
    const generation = this.generation;
    this.pending++;
    this.transcribing = this.transcribing.then(async () => {
      try {
        if (this.options.speechCheck && !(await this.options.speechCheck.hasSpeech(audio))) {
          this.log('Silero: not human voice → not transcribed');
          return;
        }
        if (!(await this.isUser(audio, voiced, fromUser))) return;
        const text = (await this.options.transcriber.transcribe(audio)).trim();
        if (generation !== this.generation) return this.log(`dropped (the microphone closed meanwhile): «${text}»`);
        if (!text) return this.log('Whisper returned no text');
        if (this.isEcho(text, fromUser ? ECHO_MIN_WORDS : 1)) return this.log(`AI echo dropped: «${text}»`);
        if (isRepetition(text)) return this.log(`endless repetition dropped: «${text}»`);
        if (!fromUser && echoLeftover(text, voiced, audioMs)) return this.log(`AI echo leftover dropped (${voiced} ms of voice in ${audioMs} ms): «${text}»`);
        this.log(`heard: «${text}»`);
        if (!fromUser) {
          this.log('the user talked over the AI (by what they said)');
          if (this.aiSpeaking()) this.bargeIn();
          else this.interruptedAI = true;
        }
        if (!this.heard.length) this.heardAt = Date.now();
        this.heard.push({ text, fromUser: true });
      } catch (error) {
        this.failure = `Could not transcribe the sentence: ${error instanceof Error ? error.message : String(error)}`;
      } finally {
        this.pending--;
        this.wake();
      }
    });
  }

  /**
   * With fewer than `minWords` words it is never echo (a user's "yes"); 1 for what started while the AI was
   * talking.
   */
  private isEcho(text: string, minWords = ECHO_MIN_WORDS): boolean {
    const now = Date.now();
    this.said = this.said.filter((said) => said.until > now);
    const heard = words(text);
    if (heard.size < minWords) return false;
    return this.said.some((said) => {
      let shared = 0;
      for (const word of heard) if (said.words.has(word)) shared++;
      return shared / heard.size >= ECHO_OVERLAP;
    });
  }

  private wake(): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) waiter();
  }
}
