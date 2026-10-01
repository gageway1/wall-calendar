import express from 'express';
import { getSetting } from '../db';
import { log } from '../logger';
import { listCalendars } from '../google/calendar-api';
import { buildAuthUrl, completeAuth, disconnect, isConfigured, isConnected } from '../google/oauth';
import { refreshAccountInfo, syncNow } from '../google/sync';

export const google = express.Router();

google.get('/status', (_req, res) => {
  res.json({
    configured: isConfigured(),
    connected: isConnected(),
    account: getSetting('google.account') || null,
    error: getSetting('google.error') || null,
    lastSyncAt: getSetting('google.last_sync_at') || null,
  });
});

/** Starts the OAuth dance. Must be opened via localhost (Google rejects LAN IPs as redirect URIs). */
google.get('/setup', (req, res) => {
  if (!['localhost', '127.0.0.1'].includes(req.hostname)) {
    res
      .status(400)
      .type('text/plain')
      .send(
        `Google only allows sign-in through http://localhost.\n\n` +
          `From your PC: ssh -L 4000:localhost:4000 <this box>\n` +
          `then open http://localhost:4000/api/google/setup`,
      );
    return;
  }
  const redirectUri = `${req.protocol}://${req.get('host')}/api/google/callback`;
  res.redirect(buildAuthUrl(redirectUri));
});

google.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  try {
    if (error) throw new Error(error);
    if (!code || !state) throw new Error('missing_code');
    await completeAuth(code, state);
    await refreshAccountInfo();
    void syncNow();
    res.redirect('/settings?google=connected');
  } catch (err) {
    log('error', 'google', 'sign-in callback failed', err);
    res.redirect('/settings?google_error=1');
  }
});

google.post('/disconnect', (_req, res) => {
  disconnect();
  res.json({ ok: true });
});

google.post('/sync', async (_req, res) => {
  await syncNow();
  res.json({ ok: true, lastSyncAt: getSetting('google.last_sync_at') || null });
});

/** Every calendar visible to the household account, for mapping to people in Settings. */
google.get('/calendars', async (_req, res, next) => {
  try {
    const calendars = await listCalendars();
    res.json(
      calendars.map((c) => ({
        id: c.id,
        name: c.summaryOverride ?? c.summary,
        color: c.backgroundColor ?? null,
        accessRole: c.accessRole,
        primary: !!c.primary,
      })),
    );
  } catch (err) {
    next(err);
  }
});
