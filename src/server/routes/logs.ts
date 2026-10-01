import express from 'express';
import { LogLevel, currentLogFile, log, recentLogs } from '../logger';

export const logs = express.Router();

const MAX_PER_MINUTE = 30;
const MAX_LENGTH = 4000;
let windowStart = 0;
let windowCount = 0;

/** Browser-side errors land here, in the same log as the server's. Rate-limited against floods. */
logs.post('/', (req, res) => {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  if (++windowCount > MAX_PER_MINUTE) {
    res.status(202).json({ dropped: true });
    return;
  }

  const { level, message, detail, url } = req.body ?? {};
  const lvl: LogLevel = level === 'warn' || level === 'info' ? level : 'error';
  const text = String(message ?? 'unknown client error').slice(0, MAX_LENGTH);
  const extra = detail === undefined ? undefined : JSON.stringify(detail).slice(0, MAX_LENGTH);
  log(lvl, 'client', text, { url, detail: extra, userAgent: req.get('user-agent') });
  res.status(202).json({ ok: true });
});

logs.get('/recent', (req, res) => {
  const limit = Math.min(100, Number(req.query['limit']) || 20);
  res.json({ file: currentLogFile(), entries: recentLogs(limit, 'warn') });
});
