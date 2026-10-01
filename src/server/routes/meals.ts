import express from 'express';
import { db } from '../db';

export const meals = express.Router();

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT = 'dinner';
const MAX_TITLE = 120;

/** Dinners for [from, to). */
meals.get('/', (req, res) => {
  const { from, to } = req.query as Record<string, string | undefined>;
  if (!from || !to || !DATE.test(from) || !DATE.test(to)) {
    res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
    return;
  }
  const rows = db()
    .prepare('SELECT day, title FROM meals WHERE slot = ? AND day >= ? AND day < ? ORDER BY day')
    .all(SLOT, from, to);
  res.json(rows);
});

/** Past dinners, most frequent first, for one-tap planning. */
meals.get('/suggestions', (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT title, COUNT(*) AS n FROM meals WHERE slot = ?
        GROUP BY title COLLATE NOCASE ORDER BY n DESC, MAX(day) DESC LIMIT 16`,
    )
    .all(SLOT) as { title: string }[];
  res.json(rows.map((r) => r.title));
});

/** Set a day's dinner; an empty title clears it. */
meals.put('/:day', (req, res) => {
  const { day } = req.params;
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!DATE.test(day) || title.length > MAX_TITLE) {
    res.status(400).json({ error: 'invalid day or title' });
    return;
  }
  if (title) {
    db()
      .prepare(
        `INSERT INTO meals (day, slot, title) VALUES (?, ?, ?)
         ON CONFLICT(day, slot) DO UPDATE SET title = excluded.title`,
      )
      .run(day, SLOT, title);
  } else {
    db().prepare('DELETE FROM meals WHERE day = ? AND slot = ?').run(day, SLOT);
  }
  res.status(204).end();
});
