import express from 'express';
import { db, getSetting, setSetting } from '../db';
import { lunchBetween, lunchUrl, syncLunch } from '../lunch/sync';

/** School lunch menu, scraped from the school's dining page (see lunch/parse.ts). */
export const lunch = express.Router();

const DATE = /^\d{4}-\d{2}-\d{2}$/;

lunch.get('/', (req, res) => {
  const { from, to } = req.query as Record<string, string | undefined>;
  if (!from || !to || !DATE.test(from) || !DATE.test(to)) {
    res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
    return;
  }
  res.json(lunchBetween(from, to));
});

lunch.get('/config', (_req, res) => {
  const personId = Number(getSetting('lunch.person_id')) || null;
  const count = db().prepare('SELECT COUNT(*) AS n, MAX(day) AS last FROM school_menu').get() as {
    n: number;
    last: string | null;
  };
  res.json({
    url: lunchUrl(),
    personId,
    lastSyncAt: getSetting('lunch.last_sync_at') || null,
    /** Set when the page loaded but no longer looked like a menu. */
    broken: getSetting('lunch.error') === 'changed',
    days: count.n,
    through: count.last,
  });
});

lunch.put('/config', async (req, res) => {
  const { url, personId } = req.body ?? {};
  if (url !== undefined) {
    if (typeof url !== 'string' || (url && !/^https?:\/\//.test(url))) {
      res.status(400).json({ error: 'url must start with http(s)://' });
      return;
    }
    setSetting('lunch.url', url.trim());
  }
  if (personId !== undefined) setSetting('lunch.person_id', personId ? String(personId) : '');
  res.status(204).end();
});

/** Fetch now; reports how many days the page had (used by Settings to confirm a new URL). */
lunch.post('/sync', async (_req, res) => {
  const n = await syncLunch();
  res.json({ days: n });
});
