import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface Expected {
  sha256?: string;
  md5?: string;
  size?: number;
}

export type Fetch = (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

/** Checks size and hashes. Throws an Error on mismatch. */
export function verify(data: Buffer, expected: Expected, name: string): void {
  if (expected.size !== undefined && data.length !== expected.size) {
    throw new Error(`${name}: size ${data.length}, expected ${expected.size}`);
  }
  for (const algorithm of ['sha256', 'md5'] as const) {
    const want = expected[algorithm];
    if (!want) continue;
    const got = createHash(algorithm).update(data).digest('hex');
    if (got !== want) throw new Error(`${name}: ${algorithm} hash mismatch (corrupted or altered download)`);
  }
}

/**
 * Downloads a file once and stores it at `dest`, only if it matches what is expected; otherwise nothing is
 * left on disk. An existing file is not downloaded again.
 */
export async function download(url: string, dest: string, expected: Expected, fetchImpl: Fetch = fetch): Promise<string> {
  if (existsSync(dest)) return dest;
  console.error(`Descargando ${url}…`);
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Cannot download ${url} (HTTP ${response.status})`);
  const data = Buffer.from(await response.arrayBuffer());
  verify(data, expected, url);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(`${dest}.part`, data);
  await rename(`${dest}.part`, dest);
  return dest;
}
