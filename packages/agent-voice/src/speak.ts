import { spawn } from 'node:child_process';

import type { Fetch } from './download.js';
import { type Catalog, chooseVoice, ensurePiper, ensureVoice, loadCatalog } from './piper.js';

export interface SpeakCommand {
  command: string;
  args: string[];
  env?: Record<string, string>;
  /** Written to the program's standard input, so the text is never read as one of its options. */
  input?: string;
}

/**
 * On Windows the text and the language go through environment variables, never inside the script, so nothing is
 * interpreted.
 */
const WINDOWS_SCRIPT = [
  'Add-Type -AssemblyName System.Speech',
  '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
  "$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq $env:SANORIVA_LANG } | Select-Object -First 1",
  'if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }',
  '$s.Speak($env:SANORIVA_TEXT)',
  '$s.Dispose()',
].join('; ');

/**
 * How to read a text out loud with the local system voice. `lang` is a 2-letter code (es, en…). On macOS and Linux the
 * text goes through standard input: as an argument, a text starting with "-" would be read as an option (writing a
 * file, reading another one).
 */
export function speakCommand(platform: NodeJS.Platform, text: string, lang?: string): SpeakCommand {
  if (platform === 'win32') {
    return {
      command: 'powershell',
      args: ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_SCRIPT],
      env: { SANORIVA_TEXT: text, SANORIVA_LANG: lang ?? '' },
    };
  }
  if (platform === 'darwin') return { command: 'say', args: ['-f', '-'], input: text };
  return { command: 'espeak-ng', args: [...(lang ? ['-v', lang] : []), '--stdin'], input: text };
}

export type RunCommand = (command: SpeakCommand, signal?: AbortSignal) => Promise<void>;

/** Runs a command until it ends. When the user talks over it (`signal`), it stops and counts as finished. */
const runCommand: RunCommand = ({ command, args, env, input }, signal) =>
  new Promise((resolve, reject) => {
    const stdin = input === undefined ? 'ignore' : 'pipe';
    const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: [stdin, 'ignore', 'pipe'], windowsHide: true });
    if (input !== undefined) {
      child.stdin?.on('error', () => {});
      child.stdin?.end(input);
    }
    signal?.addEventListener('abort', () => (child.kill(), resolve()), { once: true });
    let stderr = '';
    child.stderr?.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => reject(new Error(`Cannot speak (${command}): ${error.message}`)));
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `${command} exited with code ${code}`))));
  });

/**
 * Reads a text out loud. `language` is the language of the text (es, en, fr…), to pick the voice; `signal`
 * cuts it off.
 */
export type Speaker = (text: string, language?: string, signal?: AbortSignal) => Promise<void>;

/** The system voice (Windows, macOS or espeak-ng): always available, but it sounds robotic. */
export function createSpeaker({ lang, platform = process.platform, run = runCommand }: { lang?: string; platform?: NodeJS.Platform; run?: RunCommand } = {}): Speaker {
  return (text, language, signal) => run(speakCommand(platform, text, (language ?? lang)?.slice(0, 2)), signal);
}

/**
 * Piper generates the audio (16-bit PCM) and ffplay plays it while it is generated. -probesize/-analyzeduration make it
 * start at once, without analysing the audio first (~0.4 s saved).
 */
export function piperCommands({ piper, model, sampleRate, ffplay }: { piper: string; model: string; sampleRate: number; ffplay: string }) {
  return {
    synth: { command: piper, args: ['--model', model, '--output-raw'] },
    player: {
      command: ffplay,
      args: ['-hide_banner', '-loglevel', 'error', '-nodisp', '-autoexit', '-probesize', '32', '-analyzeduration', '0', '-f', 's16le', '-ar', String(sampleRate), '-ch_layout', 'mono', '-'],
    },
  };
}

/** ffplay starts playing roughly this long after receiving the first audio. */
const PLAYER_DELAY_MS = 300;

/**
 * The level of each 30 ms chunk of 16-bit PCM audio, with the time it will play. Piper generates faster than
 * real time, so the time comes from the position in the audio, not from when it arrives.
 */
export function pcmLevels(sampleRate: number, onLevel: (level: number, at: number, first: boolean) => void) {
  const frame = Math.round((sampleRate * 30) / 1000);
  let leftover = Buffer.alloc(0);
  let start = 0;
  let index = 0;
  return (chunk: Buffer, now = Date.now()) => {
    if (!start) start = now + PLAYER_DELAY_MS;
    const bytes = Buffer.concat([leftover, chunk]);
    let offset = 0;
    for (; offset + frame * 2 <= bytes.length; offset += frame * 2) {
      let sum = 0;
      for (let i = 0; i < frame; i++) sum += (bytes.readInt16LE(offset + i * 2) / 32_768) ** 2;
      onLevel(Math.sqrt(sum / frame), start + (index * frame * 1000) / sampleRate, index === 0);
      index++;
    }
    leftover = bytes.subarray(offset);
  };
}

/**
 * Runs Piper → ffplay with the text and resolves when playback ends (so the echo window ends at the right time) or when
 * it is cut off, in which case both processes stop and it counts as finished. Piper reads one sentence per line from
 * stdin and reports its progress on stderr, which is ignored; ffplay closing early must not crash the process.
 */
function playWithPiper(
  commands: ReturnType<typeof piperCommands>,
  text: string,
  { sampleRate, onLevel, signal }: { sampleRate: number; onLevel?: (level: number, at: number, first: boolean) => void; signal?: AbortSignal },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const synth = spawn(commands.synth.command, commands.synth.args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const player = spawn(commands.player.command, commands.player.args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    synth.stderr.on('data', () => {});
    player.stderr.on('data', (chunk) => (stderr += chunk));
    const fail = (error: Error) => {
      synth.kill();
      player.kill();
      reject(error);
    };
    synth.on('error', (error) => fail(new Error(`Cannot start Piper: ${error.message}`)));
    player.on('error', (error) => fail(new Error(`Cannot play the audio (${commands.player.command}): ${error.message}`)));
    synth.stdout.pipe(player.stdin);
    if (onLevel) synth.stdout.on('data', pcmLevels(sampleRate, onLevel));
    player.stdin.on('error', () => {});
    signal?.addEventListener('abort', () => (synth.kill(), player.kill(), resolve()), { once: true });
    player.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `ffplay exited with code ${code}`))));
    synth.stdin.end(`${text.replace(/\s+/g, ' ').trim()}\n`);
  });
}

export interface PiperSpeakerOptions {
  dataDir: string;
  ffplay: string;
  /** A fixed voice from the catalog (es_ES-davefx-medium…). Without it, a voice is chosen per language. */
  voice?: string;
  /** The language when the AI gives none. */
  language?: string;
  fetchImpl?: Fetch;
  /** Receives the level and play time of each 30 ms chunk, to tell the echo from the user's voice. */
  onLevel?: (level: number, at: number, first: boolean) => void;
}

/**
 * Natural voices with Piper. Each language's voice comes from the official Piper catalog and is downloaded
 * the first time it is needed, verified with its hash. Piper itself is also downloaded the first time.
 */
export function createPiperSpeaker({ dataDir, ffplay, voice, language, fetchImpl, onLevel }: PiperSpeakerOptions): Speaker & { warm(): void; prepare(lang?: string): Promise<void> } {
  let piper: Promise<string> | undefined;
  let catalog: Promise<Catalog> | undefined;
  const voices = new Map<string, Promise<{ model: string; sampleRate: number }>>();
  const getPiper = () => (piper ??= ensurePiper(dataDir, { fetchImpl }));
  const getCatalog = () => (catalog ??= loadCatalog(dataDir, fetchImpl));

  const voiceFor = async (lang: string | undefined) => {
    const all = await getCatalog();
    const chosen = voice ? all[voice] : chooseVoice(all, lang ?? language ?? 'en');
    if (!chosen) throw new Error(voice ? `Voice ${voice} is not in the Piper catalog` : `Piper has no voice for "${lang}"`);
    if (!voices.has(chosen.key)) voices.set(chosen.key, ensureVoice(dataDir, chosen, fetchImpl));
    return voices.get(chosen.key)!;
  };

  const speak = async (text: string, lang?: string, signal?: AbortSignal) => {
    const [exe, { model, sampleRate }] = await Promise.all([getPiper(), voiceFor(lang)]);
    if (signal?.aborted) return;
    await playWithPiper(piperCommands({ piper: exe, model, sampleRate, ffplay }), text, { sampleRate, ...(onLevel ? { onLevel } : {}), ...(signal ? { signal } : {}) });
  };
  /**
   * Starts the downloads at startup so the first sentence does not wait: Piper and its catalog, and the voice
   * only with a fixed language or voice (otherwise the voice for the language the AI speaks is downloaded
   * then).
   */
  /** Downloads Piper, its catalog and the voice for a language now (for --setup). */
  speak.prepare = async (lang?: string) => {
    await Promise.all([getPiper(), voiceFor(lang)]);
  };
  speak.warm = () => {
    void getPiper().catch(() => {});
    void getCatalog().catch(() => {});
    if (language || voice) void voiceFor(language).catch(() => {});
  };
  return speak;
}

/**
 * Speaks without blocking: each sentence waits for the previous one, but the caller goes on at once (the AI
 * can act on the page while it plays). Resolves, when that sentence ends, with whether it played whole
 * (`false`: it was cut off).
 */
export function speechQueue(speaker: Speaker, onError: (error: Error) => void = () => {}) {
  let playing: Promise<void> = Promise.resolve();
  let current = new AbortController();
  const say = (text: string, language?: string): Promise<boolean> => {
    const signal = current.signal;
    const run = playing
      .then(async () => {
        if (!signal.aborted) await speaker(text, language, signal);
      })
      .catch(onError)
      .then(() => !signal.aborted);
    playing = run.then(() => undefined);
    return run;
  };
  /**
   * The user talked: what is playing stops and what was waiting is dropped. Anything requested afterwards
   * plays.
   */
  say.cancel = () => {
    current.abort();
    current = new AbortController();
  };
  return say;
}

/** A short soft tone, generated by ffplay with no files: "I heard you, I'm thinking". */
export function chimeCommand(ffplay: string): SpeakCommand {
  return {
    command: ffplay,
    args: ['-hide_banner', '-loglevel', 'error', '-nodisp', '-autoexit', '-f', 'lavfi', '-i', 'sine=frequency=660:duration=0.15', '-af', 'volume=0.2,afade=t=out:st=0.05:d=0.1'],
  };
}

/** Plays the tone without waiting for it to end; a failure does not matter, since it is only a cue. */
export function createChime(ffplay: string, run: RunCommand = runCommand): () => void {
  return () => void run(chimeCommand(ffplay)).catch(() => {});
}
