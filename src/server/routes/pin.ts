import express from 'express';
import { getSetting, setSetting } from '../db';
import { log } from '../logger';
import { Lockout, PIN_FORMAT, hashPin, pinMatches } from '../pin';

export const pin = express.Router();

const KEY = 'pin.hash';
const LENGTH_KEY = 'pin.length';
const lockout = new Lockout();

pin.get('/', (_req, res) => {
  const set = !!getSetting(KEY);
  res.json({ set, length: set ? Number(getSetting(LENGTH_KEY)) : null });
});

/**
 * Always 200 so a wrong PIN isn't treated as an app error: { ok } or { ok: false, lockedFor }.
 */
pin.post('/verify', (req, res) => {
  const stored = getSetting(KEY);
  if (!stored) {
    res.json({ ok: true });
    return;
  }
  const wait = lockout.remaining();
  if (wait) {
    res.json({ ok: false, lockedFor: Math.ceil(wait / 1000) });
    return;
  }
  const ok = typeof req.body?.pin === 'string' && pinMatches(req.body.pin, stored);
  lockout.record(ok);
  const lockedFor = Math.ceil(lockout.remaining() / 1000);
  if (lockedFor) log('warn', 'pin', 'too many wrong PIN attempts; locked for 30s');
  res.json(ok ? { ok: true } : { ok: false, ...(lockedFor && { lockedFor }) });
});

pin.put('/', (req, res) => {
  const value = req.body?.pin;
  if (typeof value !== 'string' || !PIN_FORMAT.test(value)) {
    res.status(400).json({ error: 'PIN must be 4 to 8 digits' });
    return;
  }
  setSetting(KEY, hashPin(value));
  setSetting(LENGTH_KEY, String(value.length));
  res.status(204).end();
});

pin.delete('/', (_req, res) => {
  setSetting(KEY, '');
  setSetting(LENGTH_KEY, '');
  res.status(204).end();
});
