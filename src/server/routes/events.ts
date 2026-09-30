import express from 'express';
import { db } from '../db';

export const events = express.Router();

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Local midnight of a YYYY-MM-DD in the server's timezone (the box lives in the household's). */
function localMidnightUtc(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/**
 * Events overlapping [from, to), both local dates, `to` exclusive.
 * Timed events compare as UTC instants; all-day events compare as dates.
 */
events.get('/', (req, res) => {
  const { from, to } = req.query as Record<string, string | undefined>;
  if (!from || !to || !DATE.test(from) || !DATE.test(to)) {
    res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
    return;
  }

  const rows = db()
    .prepare(
      `SELECT e.google_event_id, e.calendar_id, e.title, e.location, e.description,
              e.start_at, e.end_at, e.all_day, p.id AS person_id, p.name AS person_name, p.color
         FROM events e
         JOIN people p ON p.google_calendar_id = e.calendar_id
        WHERE (e.all_day = 0 AND e.start_at < ? AND e.end_at > ?)
           OR (e.all_day = 1 AND e.start_at < ? AND e.end_at > ?)
        ORDER BY e.start_at, p.sort_order`,
    )
    .all(localMidnightUtc(to), localMidnightUtc(from), to, from) as Record<string, any>[];

  res.json(
    rows.map((r) => ({
      id: `${r['calendar_id']}/${r['google_event_id']}`,
      calendarId: r['calendar_id'],
      title: r['title'],
      location: r['location'],
      description: r['description'],
      start: r['start_at'],
      end: r['end_at'],
      allDay: r['all_day'] === 1,
      personId: r['person_id'],
      personName: r['person_name'],
      color: r['color'],
    })),
  );
});
