import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Where the SQLite file and logs live. Created on first use, never at import. */
export function dataDir(): string {
  const dir = resolve(process.env['DATA_DIR'] ?? 'data');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function logDir(): string {
  const dir = resolve(process.env['LOG_DIR'] ?? join(dataDir(), 'logs'));
  mkdirSync(dir, { recursive: true });
  return dir;
}
