#!/usr/bin/env node
import './stdout-guard.js';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { join } from 'node:path';

import { parseConfig, type VoiceConfig } from './config.js';
import { fileLog, silent } from './log.js';
import { Ear } from './ear.js';
import { createFfmpegMic, findWindowsMic } from './mic.js';
import { createVoiceServer } from './server.js';
import { createChime, createPiperSpeaker, createSpeaker, type Speaker, speechQueue } from './speak.js';
import { runSetup, setupSteps } from './setup.js';
import { createSileroCheck } from './speech-check.js';
import { createWhisper } from './stt.js';
import { createSpeakerCheck } from './speaker.js';
import { createTurnCheck } from './turn.js';
import { Voiceprint, voiceprintFile } from './voiceprint.js';

let config: VoiceConfig;
try {
  config = parseConfig(process.argv.slice(2));
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

/** --setup prepares everything for the first conversation and exits without starting the server. */
if (config.setup) {
  console.error('Preparing the voice (the first time it downloads about 300 MB)…');
  const ok = await runSetup(setupSteps(config));
  console.error(ok ? 'All set.' : 'Something is missing: fix it and run --setup again.');
  process.exit(ok ? 0 : 1);
}

const voiceprintPath = join(config.dataDir, 'voiceprint.json');
if (config.forgetVoice) {
  voiceprintFile(voiceprintPath).forget();
  console.error('Voiceprint deleted: the next sentences teach it again.');
  process.exit(0);
}

const log = config.verbose ? fileLog(join(config.dataDir, 'voice.log')) : silent;
log('[startup] verbose mode: what happens to each sentence goes to voice.log');

const device = config.mic ?? (process.platform === 'win32' ? findWindowsMic(config.ffmpeg) : undefined);
if (process.platform === 'win32' && !device) {
  console.error('No microphone (or ffmpeg) found. Choose one with --mic "<name>" and ffmpeg with --ffmpeg <path>.');
  process.exit(1);
}
console.error(`Microphone: ${device ?? 'system default'}`);

/** Whisper loads in the background: the server answers right away and listen waits for the model if needed. */
const transcriber = createWhisper({ model: config.model, language: config.language, cacheDir: config.cacheDir, device: config.device, log });
transcriber.then(
  () => console.error(`Whisper ready (${config.model}, ${config.device})`),
  (error: Error) => console.error(`Cannot load Whisper: ${error.message}`),
);

/** Silero VAD (2 MB) separates human voice from noise before Whisper, in any language. */
const speechCheck = createSileroCheck({ cacheDir: config.dataDir });
speechCheck.then(
  () => console.error('Voice detector ready (Silero VAD)'),
  (error: Error) => console.error(`No voice detector (Silero): ${error.message}`),
);

/**
 * Smart Turn (8 MB) tells at every 0.3 s pause whether the user has finished, so there is no need to wait for 1.5 s of
 * silence.
 */
const turnCheck = createTurnCheck({ cacheDir: config.dataDir });
turnCheck.then(
  () => console.error('End-of-turn detector ready (Smart Turn)'),
  (error: Error) => console.error(`No end-of-turn detector (Smart Turn): ${error.message}`),
);

/** WeSpeaker (26 MB) recognises the user's voice, learned once, so other voices are ignored. */
const speakerCheck = createSpeakerCheck({ cacheDir: config.dataDir });
speakerCheck.then(
  () => console.error('Voice recognition ready (WeSpeaker)'),
  (error: Error) => console.error(`No voice recognition (WeSpeaker): ${error.message}`),
);
const voiceprint = new Voiceprint(voiceprintFile(voiceprintPath));

/**
 * Piper gives a natural voice, with the system voice as a fallback. Piper and the voice download in the background at
 * startup.
 */
const system = createSpeaker({ lang: config.language });
/** The ear gets what is about to play, to tell the AI's echo from the voice of a user who interrupts it. */
const piper =
  config.tts === 'piper' ? createPiperSpeaker({ ...config, dataDir: config.dataDir, onLevel: (level, at, first) => ear?.playing(level, at, first) }) : undefined;
piper?.warm();
const speaker: Speaker = async (text, language, signal) => {
  const started = Date.now();
  if (piper) {
    try {
      await piper(text, language, signal);
      return log(`[voice] Piper · ${language ?? 'no language'} · ${Date.now() - started} ms · «${text}»`);
    } catch (error) {
      log(`[voice] Piper failed (${(error as Error).message}); using the system voice`);
      console.error(`Piper could not speak (${(error as Error).message}); using the system voice`);
    }
  }
  await system(text, language, signal);
  log(`[voice] system · ${language ?? 'no language'} · ${Date.now() - started} ms · «${text}»`);
};

/** Speaking does not block: the AI keeps working while it plays, and each sentence waits for the previous one. */
const say = speechQueue(speaker, (error) => log(`[voice] could not speak: ${error.message}`));

/** The ear starts on the first listen, so the microphone only opens when there is a conversation. */
let ear: Ear | undefined;
/**
 * The MCP server with `listen`, `speak` and `stop`. A short tone plays when a user sentence closes, so the user knows
 * they were heard while the AI thinks, and the AI goes quiet at once when the user talks over it. `speak` returns right
 * away (or, with `wait`, when playback ends) so the sentence plays while the AI goes on; the microphone stays open and
 * the ear discards the echo of what is being said until playback ends.
 */
const server = createVoiceServer({
  listen: async () => {
    ear ??= new Ear({
      openMic: createFfmpegMic({ ffmpeg: config.ffmpeg, device }),
      transcriber: await transcriber,
      speechCheck: await speechCheck.catch(() => undefined),
      turnCheck: await turnCheck.catch(() => undefined),
      speaker: await speakerCheck.catch(() => undefined),
      voiceprint,
      onPhrase: createChime(config.ffplay),
      onBargeIn: () => say.cancel(),
      log,
    });
    return ear.next();
  },
  stop: () => ear?.stop(),
  interrupt: () => ear?.interrupt(),
  speak: async (text, language, wait) => {
    const done = ear?.saying(text);
    const finished = say(text, language).finally(() => done?.());
    if (wait) return finished;
  },
});
await server.connect(new StdioServerTransport());
