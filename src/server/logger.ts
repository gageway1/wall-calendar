import { appendFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { logDir } from './paths';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  /** Where it came from: api, sync, google, client, … */
  source: string;
  message: string;
  detail?: unknown;
}

const RETAIN_DAYS = 14;
const LEVELS: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };

const fileFor = (day: string) => join(logDir(), `wall-${day}.log`);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Logs to the console (journald picks this up on the box) and to a daily JSON-lines file under
 * data/logs, kept for two weeks. Never throws: logging must not take the app down.
 */
export function log(level: LogLevel, source: string, message: string, detail?: unknown) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, source, message };
  if (detail !== undefined) entry.detail = serialize(detail);

  const line = `[${source}] ${message}`;
  const args = detail === undefined ? [line] : [line, detail];
  if (level === 'error') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  else console.log(...args);

  try {
    appendFileSync(fileFor(today()), JSON.stringify(entry) + '\n');
    pruneOncePerDay();
  } catch (err) {
    console.error('[logger] could not write log file', err);
  }
}

/** Newest-first entries at or above `minLevel` from the last two days. */
export function recentLogs(limit = 30, minLevel: LogLevel = 'warn'): LogEntry[] {
  const days = [today(), new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)];
  const out: LogEntry[] = [];
  for (const day of days) {
    const file = fileFor(day);
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, 'utf8').trimEnd().split('\n').reverse();
    for (const l of lines) {
      try {
        const e = JSON.parse(l) as LogEntry;
        if (LEVELS[e.level] >= LEVELS[minLevel]) out.push(e);
      } catch {}
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function currentLogFile() {
  return fileFor(today());
}

let lastPrune = '';
function pruneOncePerDay() {
  const day = today();
  if (lastPrune === day) return;
  lastPrune = day;
  const cutoff = new Date(Date.now() - RETAIN_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (const f of readdirSync(logDir())) {
    const m = /^wall-(\d{4}-\d{2}-\d{2})\.log$/.exec(f);
    if (m && m[1] < cutoff) rmSync(join(logDir(), f), { force: true });
  }
}

function serialize(detail: unknown, depth = 0): unknown {
  if (!(detail instanceof Error)) return detail;
  const e = detail as Error & { code?: unknown; cause?: unknown };
  return {
    name: e.name,
    message: e.message,
    ...(e.code !== undefined && { code: e.code }),
    stack: e.stack,
    ...(e.cause !== undefined && depth < 3 && { cause: serialize(e.cause, depth + 1) }),
  };
}
