import express from 'express';
import { db } from '../db';
import { log } from '../logger';
import { syncCalendar } from '../google/sync';

export const people = express.Router();

interface PersonRow {
  id: number;
  name: string;
  color: string;
  google_calendar_id: string | null;
  sort_order: number;
  access_role: string | null;
  has_chores: number;
}

export const toPerson = (r: PersonRow) => ({
  id: r.id,
  name: r.name,
  color: r.color,
  calendarId: r.google_calendar_id,
  sortOrder: r.sort_order,
  hasChores: r.has_chores === 1,
  /** Wall-only people (e.g. kids) have no calendar, so events can't be added for them. */
  canWrite:
    r.google_calendar_id !== null &&
    (r.access_role === null || r.access_role === 'writer' || r.access_role === 'owner'),
});

const COLOR = /^#[0-9a-f]{6}$/i;

function getPerson(id: number) {
  return db().prepare('SELECT * FROM people WHERE id = ?').get(id) as PersonRow | undefined;
}

people.get('/', (_req, res) => {
  const rows = db()
    .prepare('SELECT * FROM people ORDER BY sort_order, id')
    .all() as unknown as PersonRow[];
  res.json(rows.map(toPerson));
});

people.post('/', (req, res) => {
  const { name, color, calendarId, accessRole } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || !COLOR.test(color)) {
    res.status(400).json({ error: 'name and #rrggbb color are required' });
    return;
  }
  const next = db().prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM people').get() as {
    n: number;
  };
  const result = db()
    .prepare(
      'INSERT INTO people (name, color, google_calendar_id, sort_order, access_role, has_chores) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      name.trim(),
      color,
      typeof calendarId === 'string' ? calendarId : null,
      next.n,
      typeof accessRole === 'string' ? accessRole : null,
      // View-only calendars (holidays and the like) start without chores.
      accessRole === 'reader' || accessRole === 'freeBusyReader' ? 0 : 1,
    );

  // Pull the new calendar right away rather than waiting for the next sync tick.
  if (calendarId) {
    syncCalendar(calendarId).catch((err) =>
      log('error', 'sync', `initial sync of ${calendarId} failed`, err),
    );
  }
  res.status(201).json(toPerson(getPerson(Number(result.lastInsertRowid))!));
});

people.patch('/:id', (req, res) => {
  const person = getPerson(Number(req.params.id));
  if (!person) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const { name, color, sortOrder, calendarId, accessRole, hasChores } = req.body ?? {};
  if (color !== undefined && !COLOR.test(color)) {
    res.status(400).json({ error: 'color must be #rrggbb' });
    return;
  }
  // calendarId: string links a calendar, null unlinks, undefined leaves it alone.
  const relink = calendarId !== undefined && calendarId !== person.google_calendar_id;
  if (relink && calendarId !== null && typeof calendarId !== 'string') {
    res.status(400).json({ error: 'calendarId must be a string or null' });
    return;
  }

  const d = db();
  d.exec('BEGIN');
  try {
    if (relink && person.google_calendar_id) {
      d.prepare('DELETE FROM events WHERE calendar_id = ?').run(person.google_calendar_id);
      d.prepare('DELETE FROM sync_state WHERE calendar_id = ?').run(person.google_calendar_id);
    }
    d.prepare(
      'UPDATE people SET name = ?, color = ?, sort_order = ?, google_calendar_id = ?, access_role = ?, has_chores = ? WHERE id = ?',
    ).run(
      typeof name === 'string' && name.trim() ? name.trim() : person.name,
      color ?? person.color,
      Number.isInteger(sortOrder) ? sortOrder : person.sort_order,
      relink ? calendarId : person.google_calendar_id,
      relink ? (typeof accessRole === 'string' ? accessRole : null) : person.access_role,
      typeof hasChores === 'boolean' ? Number(hasChores) : person.has_chores,
      person.id,
    );
    d.exec('COMMIT');
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }

  if (relink && calendarId) {
    syncCalendar(calendarId).catch((err) =>
      log('error', 'sync', `initial sync of ${calendarId} failed`, err),
    );
  }
  res.json(toPerson(getPerson(person.id)!));
});

people.delete('/:id', (req, res) => {
  const person = getPerson(Number(req.params.id));
  if (person) {
    const d = db();
    d.exec('BEGIN');
    try {
      if (person.google_calendar_id) {
        d.prepare('DELETE FROM events WHERE calendar_id = ?').run(person.google_calendar_id);
        d.prepare('DELETE FROM sync_state WHERE calendar_id = ?').run(person.google_calendar_id);
      }
      d.prepare('DELETE FROM people WHERE id = ?').run(person.id);
      d.exec('COMMIT');
    } catch (err) {
      d.exec('ROLLBACK');
      throw err;
    }
  }
  res.status(204).end();
});
