import express from 'express';
import { db } from '../db';
import { deleteEvent, insertEvent, moveEvent, patchEvent } from '../google/calendar-api';
import { parseEventInput, toGoogleInsert, toGooglePatch } from '../google/event-input';
import { toEventRow } from '../google/event-mapping';
import { upsertEventRow } from '../google/sync';

export const events = express.Router();

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Timezone Google should file new events under: the box's, i.e. the household's. */
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Local midnight of a YYYY-MM-DD in the server's timezone (the box lives in the household's). */
function localMidnightUtc(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

const SELECT_EVENTS = `
  SELECT e.google_event_id, e.calendar_id, e.title, e.location, e.description,
         e.start_at, e.end_at, e.all_day, e.recurring,
         p.id AS person_id, p.name AS person_name, p.color
    FROM events e
    JOIN people p ON p.google_calendar_id = e.calendar_id`;

function toApiEvent(r: Record<string, any>) {
  return {
    id: `${r['calendar_id']}/${r['google_event_id']}`,
    eventId: r['google_event_id'],
    calendarId: r['calendar_id'],
    title: r['title'],
    location: r['location'],
    description: r['description'],
    start: r['start_at'],
    end: r['end_at'],
    allDay: r['all_day'] === 1,
    recurring: r['recurring'] === 1,
    personId: r['person_id'],
    personName: r['person_name'],
    color: r['color'],
  };
}

function getCachedEvent(calendarId: string, eventId: string) {
  const row = db()
    .prepare(`${SELECT_EVENTS} WHERE e.calendar_id = ? AND e.google_event_id = ?`)
    .get(calendarId, eventId) as Record<string, any> | undefined;
  return row && toApiEvent(row);
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
      `${SELECT_EVENTS}
        WHERE (e.all_day = 0 AND e.start_at < ? AND e.end_at > ?)
           OR (e.all_day = 1 AND e.start_at < ? AND e.end_at > ?)
        ORDER BY e.start_at, p.sort_order`,
    )
    .all(localMidnightUtc(to), localMidnightUtc(from), to, from) as Record<string, any>[];

  res.json(rows.map(toApiEvent));
});

/** Most-used recent titles per person, for one-tap quick-add. */
events.get('/suggestions', (_req, res) => {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const rows = db()
    .prepare(
      `SELECT e.title, p.id AS person_id, COUNT(*) AS n
         FROM events e
         JOIN people p ON p.google_calendar_id = e.calendar_id
        WHERE e.start_at >= ?
        GROUP BY e.title COLLATE NOCASE, p.id
        ORDER BY n DESC
        LIMIT 60`,
    )
    .all(since) as { title: string; person_id: number; n: number }[];
  res.json(rows.map((r) => ({ title: r.title, personId: r.person_id, count: r.n })));
});

function writableCalendarFor(personId: number): string | undefined {
  const p = db()
    .prepare('SELECT google_calendar_id, access_role FROM people WHERE id = ?')
    .get(personId) as { google_calendar_id: string | null; access_role: string | null } | undefined;
  if (!p?.google_calendar_id) return undefined;
  if (p.access_role && p.access_role !== 'writer' && p.access_role !== 'owner') return undefined;
  return p.google_calendar_id;
}

events.post('/', async (req, res) => {
  const input = parseEventInput(req.body);
  if (typeof input === 'string') {
    res.status(400).json({ error: input });
    return;
  }
  const calendarId = writableCalendarFor(input.personId);
  if (!calendarId) {
    res.status(400).json({ error: "That person's calendar can't be written to" });
    return;
  }

  const created = await insertEvent(calendarId, toGoogleInsert(input, timeZone()));
  const row = toEventRow(calendarId, created);
  if (row) upsertEventRow(row);
  res.status(201).json(getCachedEvent(calendarId, created.id));
});

events.patch('/:calendarId/:eventId', async (req, res) => {
  const { calendarId, eventId } = req.params;
  const input = parseEventInput(req.body);
  if (typeof input === 'string') {
    res.status(400).json({ error: input });
    return;
  }
  const target = writableCalendarFor(input.personId);
  if (!target) {
    res.status(400).json({ error: "That person's calendar can't be written to" });
    return;
  }

  // Changing the person moves the event to their calendar first.
  let currentCalendar = calendarId;
  if (target !== calendarId) {
    await moveEvent(calendarId, eventId, target);
    db()
      .prepare('DELETE FROM events WHERE calendar_id = ? AND google_event_id = ?')
      .run(calendarId, eventId);
    currentCalendar = target;
  }

  const updated = await patchEvent(currentCalendar, eventId, toGooglePatch(input, timeZone()));
  const row = toEventRow(currentCalendar, updated);
  if (row) upsertEventRow(row);
  res.json(getCachedEvent(currentCalendar, updated.id));
});

events.delete('/:calendarId/:eventId', async (req, res) => {
  const { calendarId, eventId } = req.params;
  await deleteEvent(calendarId, eventId);
  db()
    .prepare('DELETE FROM events WHERE calendar_id = ? AND google_event_id = ?')
    .run(calendarId, eventId);
  res.status(204).end();
});
