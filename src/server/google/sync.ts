import { db, getSetting, setSetting } from '../db';
import { listCalendars, listEvents } from './calendar-api';
import { EventRow, toEventRow } from './event-mapping';
import { log } from '../logger';
import { networkErrorCode } from '../net-errors';
import { NotConnectedError, isConnected } from './oauth';

const SYNC_INTERVAL_MS = 90 * 1000;
const WINDOW_PAST_DAYS = 60;
const WINDOW_FUTURE_DAYS = 400;

export function upsertEventRow(row: EventRow) {
  db()
    .prepare(
      `INSERT OR REPLACE INTO events
        (google_event_id, calendar_id, title, location, description, start_at, end_at, all_day, recurring, updated_at)
      VALUES
        (:google_event_id, :calendar_id, :title, :location, :description, :start_at, :end_at, :all_day, :recurring, :updated_at)`,
    )
    .run({ ...row });
}

/**
 * Re-fetch a fixed window per calendar and replace its cache. A family calendar is a few hundred
 * events, so this is cheap, and it sidesteps syncToken's incompatibility with time windows.
 */
export async function syncCalendar(calendarId: string) {
  const now = Date.now();
  const timeMin = new Date(now - WINDOW_PAST_DAYS * 86_400_000);
  const timeMax = new Date(now + WINDOW_FUTURE_DAYS * 86_400_000);

  const rows = (await listEvents(calendarId, timeMin, timeMax))
    .map((e) => toEventRow(calendarId, e))
    .filter((r) => r !== null);

  const d = db();
  d.exec('BEGIN');
  try {
    d.prepare('DELETE FROM events WHERE calendar_id = ?').run(calendarId);
    for (const row of rows) upsertEventRow(row);
    d.prepare(
      `INSERT INTO sync_state (calendar_id, last_sync_at) VALUES (?, ?)
       ON CONFLICT(calendar_id) DO UPDATE SET last_sync_at = excluded.last_sync_at`,
    ).run(calendarId, new Date().toISOString());
    d.exec('COMMIT');
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
  return rows.length;
}

export async function syncAll() {
  const calendars = db()
    .prepare('SELECT google_calendar_id AS id FROM people WHERE google_calendar_id IS NOT NULL')
    .all() as { id: string }[];

  let failed = 0;
  let offline: string | undefined;

  const attempt = async (what: string, fn: () => Promise<unknown>) => {
    if (offline) return; // No point trying the rest while the network is down.
    try {
      await fn();
    } catch (err) {
      if (err instanceof NotConnectedError) throw err;
      offline = networkErrorCode(err);
      if (offline) return;
      failed++;
      log('error', 'sync', `${what} failed`, err);
    }
  };

  await attempt('calendar list refresh', refreshAccessRoles);
  for (const { id } of calendars) await attempt(`calendar ${id}`, () => syncCalendar(id));

  noteReachability(offline);
  if (offline) return; // Keep last_sync_at honest: the wall is showing older data.

  setSetting('google.last_sync_at', new Date().toISOString());
  if (failed === 0 && getSetting('google.error')) setSetting('google.error', '');
}

let unreachableSince: string | undefined;

/** Logs outage start and end once each, instead of every failed attempt every 90 s. */
function noteReachability(offlineCode: string | undefined) {
  if (offlineCode && !unreachableSince) {
    unreachableSince = new Date().toISOString();
    log(
      'warn',
      'sync',
      `Google unreachable (${offlineCode}); showing cached events, retrying every 90s`,
    );
  } else if (!offlineCode && unreachableSince) {
    log('info', 'sync', `Google reachable again (offline since ${unreachableSince})`);
    unreachableSince = undefined;
  }
}

/** Caches whether each person's calendar is writable, so the wall can grey out read-only ones. */
async function refreshAccessRoles() {
  const update = db().prepare('UPDATE people SET access_role = ? WHERE google_calendar_id = ?');
  for (const c of await listCalendars()) update.run(c.accessRole, c.id);
}

/** Records which Google account is connected (its primary calendar id is the email address). */
export async function refreshAccountInfo() {
  const primary = (await listCalendars()).find((c) => c.primary);
  if (primary) setSetting('google.account', primary.id);
}

let running = false;

export async function syncNow() {
  if (running || !isConnected()) return;
  running = true;
  try {
    await syncAll();
  } catch (err) {
    log(err instanceof NotConnectedError ? 'warn' : 'error', 'sync', 'sync failed', err);
  } finally {
    running = false;
  }
}

// Stored on globalThis so a dev-server hot reload replaces the previous module's loop
// instead of stacking another one next to it.
const g = globalThis as { __wallSyncTimer?: ReturnType<typeof setInterval> };
clearInterval(g.__wallSyncTimer);
g.__wallSyncTimer = undefined;

/** Idempotent; called on first API request so the Angular build never starts it. */
export function ensureSyncLoop() {
  if (g.__wallSyncTimer) return;
  g.__wallSyncTimer = setInterval(syncNow, SYNC_INTERVAL_MS);
  void syncNow();
}
