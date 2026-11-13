import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { download, type Fetch } from './download.js';

/**
 * Piper (MIT): natural local voices, fast on a regular CPU. Pinned version with the SHA-256 of each download
 * computed when pinning it: it is an executable, so nothing else is accepted.
 */
export const PIPER_VERSION = '2023.11.14-2';
const PIPER_URL = `https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}`;
const PIPER_ASSETS: Record<string, { file: string; sha256: string; size: number }> = {
  'win32-x64': { file: 'piper_windows_amd64.zip', size: 22477236, sha256: 'f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea' },
  'linux-x64': { file: 'piper_linux_x86_64.tar.gz', size: 26460462, sha256: 'a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992' },
  'linux-arm64': { file: 'piper_linux_aarch64.tar.gz', size: 26004717, sha256: 'fea0fd2d87c54dbc7078d0f878289f404bd4d6eea6e7444a77835d1537ab88eb' },
  'darwin-x64': { file: 'piper_macos_x64.tar.gz', size: 19146927, sha256: 'ced85c0a3df13945b1e623b878a48fdc2854d5c485b4b67f62857cf551deaf8b' },
  'darwin-arm64': { file: 'piper_macos_aarch64.tar.gz', size: 19146957, sha256: '6b1eb03b3735946cb35216e063e7eebcc33a6bbf5dd96ec0217959bf1cdcb0cc' },
};

/**
 * The official Piper voice catalog, at a pinned revision of the repository. It carries the hash of every
 * file.
 */
const VOICES_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/e7229f7d33a10e145e109b886d661984201ac3c4';

export interface CatalogVoice {
  key: string;
  language: { code: string; family: string };
  quality: string;
  files: Record<string, { size_bytes: number; md5_digest: string }>;
}
export type Catalog = Record<string, CatalogVoice>;

/**
 * Piper quality levels, from the best balance of naturalness and speed to the worst. This is Piper's own
 * scale (x_low, low, medium, high): medium sounds natural and is fast; high is slightly better and slower.
 */
const QUALITY_PREFERENCE = ['medium', 'high', 'low', 'x_low'];

/**
 * The voice for a language: one for its exact variant if any (es_MX), otherwise one for its family (es);
 * among several, the best quality according to QUALITY_PREFERENCE and, on a tie, the first by name.
 */
export function chooseVoice(catalog: Catalog, language: string): CatalogVoice | undefined {
  const code = language.replace('-', '_');
  const family = code.split('_')[0]!.toLowerCase();
  const all = Object.values(catalog);
  const exact = all.filter((v) => v.language.code.toLowerCase() === code.toLowerCase());
  const candidates = exact.length ? exact : all.filter((v) => v.language.family === family);
  const rank = (v: CatalogVoice) => {
    const index = QUALITY_PREFERENCE.indexOf(v.quality);
    return index < 0 ? QUALITY_PREFERENCE.length : index;
  };
  return candidates.sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key))[0];
}

/** The piper executable for this machine: downloaded, verified and extracted the first time. */
export async function ensurePiper(
  dataDir: string,
  { platform = process.platform, arch = process.arch, fetchImpl }: { platform?: NodeJS.Platform; arch?: string; fetchImpl?: Fetch } = {},
): Promise<string> {
  const asset = PIPER_ASSETS[`${platform}-${arch}`];
  if (!asset) throw new Error(`Piper has no build for ${platform}-${arch}: use --tts system`);
  const dir = join(dataDir, 'piper', PIPER_VERSION);
  const exe = join(dir, 'piper', platform === 'win32' ? 'piper.exe' : 'piper');
  if (existsSync(exe)) return exe;
  const archive = await download(`${PIPER_URL}/${asset.file}`, join(dir, asset.file), asset, fetchImpl);
  await extract(archive, dir, platform);
  await rm(archive);
  if (!existsSync(exe)) throw new Error(`No encuentro piper tras descomprimir ${asset.file}`);
  return exe;
}

/** Extracts with tar: on Windows the system one (it opens .zip); elsewhere the usual one. */
function extract(archive: string, into: string, platform: NodeJS.Platform): Promise<void> {
  const tar = platform === 'win32' ? join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
  return new Promise((resolve, reject) => {
    const child = spawn(tar, ['-xf', archive, '-C', into], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Cannot extract Piper: ${stderr.trim()}`))));
  });
}

/** The voice catalog, stored the first time. */
export async function loadCatalog(dataDir: string, fetchImpl?: Fetch): Promise<Catalog> {
  const file = await download(`${VOICES_URL}/voices.json`, join(dataDir, 'voices', 'voices.json'), {}, fetchImpl);
  return JSON.parse(await readFile(file, 'utf8')) as Catalog;
}

/** The files of a voice, verified with the catalog hashes. Returns the model and its sample rate. */
export async function ensureVoice(dataDir: string, voice: CatalogVoice, fetchImpl?: Fetch): Promise<{ model: string; sampleRate: number }> {
  const paths: Record<string, string> = {};
  for (const [path, { size_bytes, md5_digest }] of Object.entries(voice.files)) {
    if (!path.endsWith('.onnx') && !path.endsWith('.onnx.json')) continue;
    paths[path.endsWith('.json') ? 'config' : 'model'] = await download(
      `${VOICES_URL}/${path}`,
      join(dataDir, 'voices', path),
      { size: size_bytes, md5: md5_digest },
      fetchImpl,
    );
  }
  if (!paths['model'] || !paths['config']) throw new Error(`Voice ${voice.key} has no model in the catalog`);
  const config = JSON.parse(await readFile(paths['config'], 'utf8')) as { audio?: { sample_rate?: number } };
  return { model: paths['model'], sampleRate: config.audio?.sample_rate ?? 22_050 };
}
