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
}

export const toPerson = (r: PersonRow) => ({
  id: r.id,
  name: r.name,
  color: r.color,
  calendarId: r.google_calendar_id,
  sortOrder: r.sort_order,
  canWrite: r.access_role === null || r.access_role === 'writer' || r.access_role === 'owner',
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
      'INSERT INTO people (name, color, google_calendar_id, sort_order, access_role) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      name.trim(),
      color,
      typeof calendarId === 'string' ? calendarId : null,
      next.n,
      typeof accessRole === 'string' ? accessRole : null,
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
  const { name, color, sortOrder } = req.body ?? {};
  if (color !== undefined && !COLOR.test(color)) {
    res.status(400).json({ error: 'color must be #rrggbb' });
    return;
  }
  db()
    .prepare('UPDATE people SET name = ?, color = ?, sort_order = ? WHERE id = ?')
    .run(
      typeof name === 'string' && name.trim() ? name.trim() : person.name,
      color ?? person.color,
      Number.isInteger(sortOrder) ? sortOrder : person.sort_order,
      person.id,
    );
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
