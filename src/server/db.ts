import type { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Loaded at runtime: esbuild rewrites `node:sqlite` to the nonexistent bare `sqlite`.
const { DatabaseSync: Database } = process.getBuiltinModule(
  'node:sqlite',
) as typeof import('node:sqlite');

let instance: DatabaseSync | undefined;

/** Opened lazily so the Angular build (which imports server.ts to extract routes) never touches disk. */
export function db(): DatabaseSync {
  if (!instance) {
    const dataDir = resolve(process.env['DATA_DIR'] ?? 'data');
    mkdirSync(dataDir, { recursive: true });
    instance = new Database(join(dataDir, 'wall.db'));
    instance.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    migrate(instance);
  }
  return instance;
}

/**
 * Append-only migrations. Each entry runs once, in order; never edit a shipped one.
 */
const migrations: string[] = [
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- A household member. Maps to one Google calendar shared into the household account.
  CREATE TABLE people (
    id                 INTEGER PRIMARY KEY,
    name               TEXT NOT NULL,
    color              TEXT NOT NULL,
    google_calendar_id TEXT UNIQUE,
    sort_order         INTEGER NOT NULL DEFAULT 0
  );

  -- Local cache of Google events; Google remains the source of truth.
  CREATE TABLE events (
    google_event_id TEXT NOT NULL,
    calendar_id     TEXT NOT NULL,
    title           TEXT NOT NULL,
    location        TEXT,
    description     TEXT,
    start_at        TEXT NOT NULL, -- ISO datetime, or YYYY-MM-DD when all_day
    end_at          TEXT NOT NULL,
    all_day         INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL,
    PRIMARY KEY (calendar_id, google_event_id)
  );
  CREATE INDEX events_start ON events (start_at);

  CREATE TABLE sync_state (
    calendar_id  TEXT PRIMARY KEY,
    sync_token   TEXT,
    last_sync_at TEXT
  );

  CREATE TABLE chores (
    id         INTEGER PRIMARY KEY,
    person_id  INTEGER REFERENCES people(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    recurrence TEXT NOT NULL DEFAULT 'daily', -- daily | weekly:<0-6> | once
    active     INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE chore_completions (
    chore_id     INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
    day          TEXT NOT NULL, -- YYYY-MM-DD
    completed_at TEXT NOT NULL,
    PRIMARY KEY (chore_id, day)
  );

  CREATE TABLE meals (
    day   TEXT NOT NULL, -- YYYY-MM-DD
    slot  TEXT NOT NULL, -- breakfast | lunch | dinner
    title TEXT NOT NULL,
    PRIMARY KEY (day, slot)
  );

  CREATE TABLE grocery_items (
    id         INTEGER PRIMARY KEY,
    title      TEXT NOT NULL,
    checked    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  `,
];

function migrate(db: DatabaseSync) {
  const current = (db.prepare('PRAGMA user_version').get() as { user_version: number })
    .user_version;
  for (let v = current; v < migrations.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(migrations[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

export function getSetting(key: string): string | undefined {
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  db()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run(key, value);
}
