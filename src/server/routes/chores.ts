import express from 'express';
import { db } from '../db';
import {
  Chore,
  addDay,
  formatRecurrence,
  isShownOn,
  parseRecurrence,
  recurrenceFromInput,
  streak,
} from '../chores/logic';

export const chores = express.Router();

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TITLE = 120;
const STREAK_LOOKBACK_DAYS = 400;

interface ChoreRow {
  id: number;
  person_id: number;
  title: string;
  recurrence: string;
  created_on: string;
  archived_on: string | null;
}

const toChore = (r: ChoreRow): Chore => ({
  id: r.id,
  personId: r.person_id,
  title: r.title,
  recurrence: parseRecurrence(r.recurrence),
  createdOn: r.created_on,
  archivedOn: r.archived_on,
});

/** The client's "today" (the wall's local date); server time is only a fallback. */
function dayParam(v: unknown): string {
  if (typeof v === 'string' && DATE.test(v)) return v;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function activeChores(): Chore[] {
  return (
    db()
      .prepare(
        `SELECT c.* FROM chores c JOIN people p ON p.id = c.person_id
          WHERE c.archived_on IS NULL AND p.has_chores = 1 ORDER BY c.sort_order, c.id`,
      )
      .all() as unknown as ChoreRow[]
  ).map(toChore);
}

/** Every chore that could still matter: active ones plus ones archived inside the streak window. */
function choresForStreaks(today: string): Chore[] {
  return (
    db()
      .prepare(
        `SELECT c.* FROM chores c JOIN people p ON p.id = c.person_id
          WHERE p.has_chores = 1 AND (c.archived_on IS NULL OR c.archived_on > ?)`,
      )
      .all(addDay(today, -STREAK_LOOKBACK_DAYS)) as unknown as ChoreRow[]
  ).map(toChore);
}

function completions(since: string): { chore_id: number; day: string }[] {
  return db().prepare('SELECT chore_id, day FROM chore_completions WHERE day >= ?').all(since) as {
    chore_id: number;
    day: string;
  }[];
}

/** All active chores, for the management screen. */
chores.get('/', (_req, res) => {
  res.json(activeChores());
});

/** One day's list: what's shown, whether it's done, and each person's streak. */
chores.get('/day', (req, res) => {
  const day = dayParam(req.query['day']);
  const all = activeChores();

  // When each one-time task was completed (if ever).
  const onceDone = new Map(
    (
      db()
        .prepare(
          `SELECT c.chore_id, MIN(c.day) AS day FROM chore_completions c
             JOIN chores ch ON ch.id = c.chore_id
            WHERE ch.recurrence LIKE 'once:%' GROUP BY c.chore_id`,
        )
        .all() as { chore_id: number; day: string }[]
    ).map((r) => [r.chore_id, r.day]),
  );
  const doneToday = new Set(
    (
      db().prepare('SELECT chore_id FROM chore_completions WHERE day = ?').all(day) as {
        chore_id: number;
      }[]
    ).map((r) => r.chore_id),
  );

  const items = all
    .filter((c) => isShownOn(c, day, onceDone.get(c.id)))
    .map((c) => ({
      ...c,
      done: c.recurrence.kind === 'once' ? onceDone.has(c.id) : doneToday.has(c.id),
      overdue: c.recurrence.kind === 'once' && !onceDone.has(c.id) && c.recurrence.date < day,
    }));

  const forStreaks = choresForStreaks(day);
  const done = new Set(
    completions(addDay(day, -STREAK_LOOKBACK_DAYS)).map((r) => `${r.chore_id}:${r.day}`),
  );
  const personIds = [...new Set(forStreaks.map((c) => c.personId))];
  const streaks = Object.fromEntries(
    personIds.map((id) => [
      id,
      streak(
        forStreaks.filter((c) => c.personId === id),
        done,
        day,
      ),
    ]),
  );

  res.json({ day, items, streaks });
});

function parseChoreBody(body: any) {
  const { personId, title, recurrence } = body ?? {};
  if (!Number.isInteger(personId)) return 'personId is required';
  if (typeof title !== 'string' || !title.trim()) return 'title is required';
  if (title.length > MAX_TITLE) return 'title is too long';
  const r = recurrenceFromInput(recurrence);
  if (!r) return 'recurrence is invalid';
  const person = db().prepare('SELECT id FROM people WHERE id = ?').get(personId);
  if (!person) return 'unknown person';
  return { personId: personId as number, title: title.trim(), recurrence: r };
}

chores.post('/', (req, res) => {
  const input = parseChoreBody(req.body);
  if (typeof input === 'string') {
    res.status(400).json({ error: input });
    return;
  }
  const createdOn = dayParam(req.body?.today);
  const next = db().prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM chores').get() as {
    n: number;
  };
  const result = db()
    .prepare(
      'INSERT INTO chores (person_id, title, recurrence, created_on, sort_order) VALUES (?, ?, ?, ?, ?)',
    )
    .run(input.personId, input.title, formatRecurrence(input.recurrence), createdOn, next.n);
  const row = db()
    .prepare('SELECT * FROM chores WHERE id = ?')
    .get(result.lastInsertRowid) as unknown as ChoreRow;
  res.status(201).json(toChore(row));
});

chores.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db().prepare('SELECT * FROM chores WHERE id = ?').get(id) as
    ChoreRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const input = parseChoreBody(req.body);
  if (typeof input === 'string') {
    res.status(400).json({ error: input });
    return;
  }
  db()
    .prepare('UPDATE chores SET person_id = ?, title = ?, recurrence = ? WHERE id = ?')
    .run(input.personId, input.title, formatRecurrence(input.recurrence), id);
  const row = db().prepare('SELECT * FROM chores WHERE id = ?').get(id) as unknown as ChoreRow;
  res.json(toChore(row));
});

/** Archive rather than delete, so past days keep counting toward streaks. */
chores.delete('/:id', (req, res) => {
  const today = dayParam(req.query['today']);
  db()
    .prepare('UPDATE chores SET archived_on = ? WHERE id = ? AND archived_on IS NULL')
    .run(today, Number(req.params.id));
  res.status(204).end();
});

chores.put('/:id/done/:day', (req, res) => {
  const { id, day } = req.params;
  if (!DATE.test(day)) {
    res.status(400).json({ error: 'day must be YYYY-MM-DD' });
    return;
  }
  db()
    .prepare(
      'INSERT OR IGNORE INTO chore_completions (chore_id, day, completed_at) VALUES (?, ?, ?)',
    )
    .run(Number(id), day, new Date().toISOString());
  res.status(204).end();
});

chores.delete('/:id/done/:day', (req, res) => {
  const { id, day } = req.params;
  db().prepare('DELETE FROM chore_completions WHERE chore_id = ? AND day = ?').run(Number(id), day);
  res.status(204).end();
});
