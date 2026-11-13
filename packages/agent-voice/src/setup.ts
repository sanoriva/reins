import { spawnSync } from 'node:child_process';

import type { VoiceConfig } from './config.js';
import { findWindowsMic } from './mic.js';
import { createPiperSpeaker } from './speak.js';
import { createSileroCheck } from './speech-check.js';
import { createWhisper } from './stt.js';
import { createSpeakerCheck } from './speaker.js';
import { createTurnCheck } from './turn.js';

/** A setup step: returns what it did, or throws an Error explaining how to fix it. */
export interface SetupStep {
  name: string;
  run: () => Promise<string>;
}

/** Runs the steps in order, even if one fails, and reports each one. Returns true when all succeed. */
export async function runSetup(steps: SetupStep[], print: (line: string) => void = console.error): Promise<boolean> {
  let ok = true;
  for (const step of steps) {
    const started = Date.now();
    try {
      const done = await step.run();
      print(`✓ ${step.name}: ${done} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
    } catch (error) {
      ok = false;
      print(`✗ ${step.name}: ${(error as Error).message}`);
    }
  }
  return ok;
}

/** How to install ffmpeg (it includes ffplay) on each operating system. */
const FFMPEG_HELP: Partial<Record<NodeJS.Platform, string>> = {
  win32: 'install it with "winget install Gyan.FFmpeg" and open a new terminal, or point to it with --ffmpeg <path>',
  darwin: 'install it with "brew install ffmpeg", or point to it with --ffmpeg <path>',
  linux: 'install it with your package manager (e.g. "sudo apt install ffmpeg"), or point to it with --ffmpeg <path>',
};

function checkProgram(program: string): string {
  const { status, stdout, error } = spawnSync(program, ['-version'], { encoding: 'utf8', windowsHide: true });
  if (error || status !== 0) throw new Error(`${program} not found: ${FFMPEG_HELP[process.platform] ?? FFMPEG_HELP.linux}`);
  return stdout.split('\n')[0]!.trim();
}

/**
 * Prepares everything for the first conversation: checks ffmpeg, ffplay and the microphone, and downloads the
 * models (Whisper, Silero, Smart Turn, Piper and the voice for the language). It installs nothing on the
 * system.
 */
export function setupSteps(config: VoiceConfig): SetupStep[] {
  return [
    { name: 'ffmpeg (microphone)', run: async () => checkProgram(config.ffmpeg) },
    { name: 'ffplay (speaker)', run: async () => checkProgram(config.ffplay) },
    {
      name: 'Microphone',
      run: async () => {
        if (config.mic) return config.mic;
        if (process.platform !== 'win32') return 'system default';
        const mic = findWindowsMic(config.ffmpeg);
        if (!mic) throw new Error('ffmpeg sees no microphone: plug one in or choose it with --mic "<name>"');
        return mic;
      },
    },
    {
      name: `Whisper (${config.model}, ${config.device})`,
      run: async () => (await createWhisper({ model: config.model, language: config.language, cacheDir: config.cacheDir, device: config.device }), 'downloaded and tested'),
    },
    { name: 'Silero VAD', run: async () => (await createSileroCheck({ cacheDir: config.dataDir }), 'downloaded') },
    { name: 'Smart Turn', run: async () => (await createTurnCheck({ cacheDir: config.dataDir }), 'downloaded') },
    { name: 'WeSpeaker', run: async () => (await createSpeakerCheck({ cacheDir: config.dataDir }), 'downloaded') },
    ...(config.tts === 'piper'
      ? [
          {
            name: `Piper and its voice (${config.voice ?? config.language ?? 'en'})`,
            run: async () => (await createPiperSpeaker({ ...config }).prepare(config.language), 'downloaded'),
          },
        ]
      : []),
  ];
}
