import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { DEFAULT_WHISPER_MODEL, defaultDevice, type WhisperDevice } from './stt.js';

export interface VoiceConfig {
  model: string;
  /** `dml` (the graphics card, the default on Windows) or `cpu`. */
  device: WhisperDevice;
  /**
   * A 2-letter code (es, en…) to fix the language. Without it, Whisper detects the language of each sentence.
   */
  language?: string;
  /** `piper` (default) for natural local voices, `system` for the operating system voice. */
  tts: 'piper' | 'system';
  /** A fixed voice from the Piper catalog, e.g. es_ES-davefx-medium. */
  voice?: string;
  ffplay: string;
  /** On Windows, without it the first microphone ffmpeg lists is used. */
  mic?: string;
  ffmpeg: string;
  cacheDir: string;
  dataDir: string;
  /** Logs what happens to each sentence in ~/.sanoriva-agent/voice.log. */
  verbose: boolean;
  /** Only prepares: checks ffmpeg, ffplay and the microphone, downloads the models and exits. */
  setup: boolean;
  /** Deletes the learned voiceprint and exits: the next sentences teach it again. */
  forgetVoice: boolean;
}

/**
 * Parses the command line. Throws an Error with the reason when an argument is invalid. When only `--ffmpeg` is given,
 * `ffplay` is looked for next to it, since it ships with ffmpeg.
 * @example
 * parseConfig(['--language', 'es', '--verbose']);
 */
export function parseConfig(args: string[]): VoiceConfig {
  const { values } = parseArgs({
    args,
    options: {
      model: { type: 'string' },
      device: { type: 'string' },
      language: { type: 'string' },
      mic: { type: 'string' },
      ffmpeg: { type: 'string' },
      ffplay: { type: 'string' },
      tts: { type: 'string' },
      voice: { type: 'string' },
      verbose: { type: 'boolean' },
      setup: { type: 'boolean' },
      'forget-voice': { type: 'boolean' },
    },
  });
  if (values.tts !== undefined && values.tts !== 'piper' && values.tts !== 'system') {
    throw new Error(`Invalid voice: --tts ${values.tts} (use piper or system)`);
  }
  if (values.language !== undefined && !/^[a-z]{2}$/.test(values.language)) {
    throw new Error(`Invalid language: ${values.language} (use 2 letters, e.g. --language es)`);
  }
  if (values.device !== undefined && values.device !== 'cpu' && values.device !== 'dml') {
    throw new Error(`Invalid device: --device ${values.device} (use cpu or dml)`);
  }
  const ffmpeg = values.ffmpeg ?? 'ffmpeg';
  const dataDir = join(homedir(), '.sanoriva-agent');
  return {
    model: values.model ?? DEFAULT_WHISPER_MODEL,
    device: (values.device as WhisperDevice | undefined) ?? defaultDevice(),
    ...(values.language ? { language: values.language } : {}),
    ...(values.mic ? { mic: values.mic } : {}),
    tts: (values.tts as 'piper' | 'system' | undefined) ?? 'piper',
    ...(values.voice ? { voice: values.voice } : {}),
    ffmpeg,
    ffplay: values.ffplay ?? (values.ffmpeg ? join(dirname(ffmpeg), basename(ffmpeg).replace(/ffmpeg/i, 'ffplay')) : 'ffplay'),
    cacheDir: join(dataDir, 'models'),
    dataDir,
    verbose: values.verbose ?? false,
    setup: values.setup ?? false,
    forgetVoice: values['forget-voice'] ?? false,
  };
}
