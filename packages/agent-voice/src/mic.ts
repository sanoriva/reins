import { spawn, spawnSync } from 'node:child_process';

/** The sample rate Whisper expects; the microphone is recorded at it directly. */
export const SAMPLE_RATE = 16_000;

/** The open microphone: 16-bit PCM, mono, 16 kHz. */
export interface Mic {
  onData(listener: (chunk: Buffer) => void): void;
  onExit(listener: (reason: string) => void): void;
  stop(): void;
}

export type OpenMic = () => Mic;

/** How ffmpeg opens the microphone on each operating system. */
export function inputArgs(platform: NodeJS.Platform, device: string | undefined): string[] {
  if (platform === 'win32') return ['-f', 'dshow', '-i', `audio=${device}`];
  if (platform === 'darwin') return ['-f', 'avfoundation', '-i', `:${device ?? 'default'}`];
  return ['-f', 'pulse', '-i', device ?? 'default'];
}

/** On Windows the microphone must be named: the first one ffmpeg lists. */
export function findWindowsMic(ffmpeg: string): string | undefined {
  const { stderr } = spawnSync(ffmpeg, ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return /"([^"]+)" \(audio\)/.exec(stderr ?? '')?.[1];
}

/** The computer microphone through ffmpeg. It is only open while listening. */
export function createFfmpegMic({ ffmpeg, device }: { ffmpeg: string; device?: string }): OpenMic {
  return () => {
    const child = spawn(
      ffmpeg,
      ['-hide_banner', '-loglevel', 'error', ...inputArgs(process.platform, device), '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', '-'],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    let stopped = false;
    return {
      onData: (listener) => child.stdout.on('data', listener),
      onExit: (listener) => {
        child.on('error', (error) => listener(`Cannot start ffmpeg (${ffmpeg}): ${error.message}`));
        child.on('close', () => {
          if (!stopped) listener(stderr.trim() || 'The microphone closed');
        });
      },
      stop: () => {
        stopped = true;
        child.kill();
      },
    };
  };
}
