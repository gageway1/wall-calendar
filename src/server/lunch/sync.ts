import { db, getSetting, setSetting } from '../db';
import { log } from '../logger';
import { networkErrorCode } from '../net-errors';
import { SchoolMenuDay, niceCase, noSchoolLabel, parseDiningPage, parseMenusJson } from './parse';

const REFRESH_MS = 6 * 60 * 60 * 1000;

export function lunchUrl(): string {
  return getSetting('lunch.url') || process.env['SCHOOL_LUNCH_URL'] || '';
}

/**
 * Pulls the school's posted menus and stores them, so the wall keeps showing them offline and
 * past days stay. Menus come out about monthly; checking every 6 hours picks them up same-day.
 */
export async function syncLunch(): Promise<number> {
  const url = lunchUrl();
  if (!url) return 0;

  const days = await fetchMenus(url);

  const d = db();
  const upsert = d.prepare(
    `INSERT INTO school_menu (day, breakfast, lunch, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET breakfast = excluded.breakfast, lunch = excluded.lunch,
       updated_at = excluded.updated_at`,
  );
  const now = new Date().toISOString();
  d.exec('BEGIN');
  try {
    for (const m of days)
      upsert.run(m.day, JSON.stringify(m.breakfast), JSON.stringify(m.lunch), now);
    d.exec('COMMIT');
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
  setSetting('lunch.last_sync_at', now);
  setSetting('lunch.error', '');
  return days.length;
}

const HEADERS = { 'user-agent': 'wall-calendar (family wall display)' };
const MAX_PAGES = 10;

/** JSON API (followed across pages) when given one, else the dining page itself. */
async function fetchMenus(url: string): Promise<SchoolMenuDay[]> {
  if (/thrillshare\.com\/api\//.test(url)) {
    const all: SchoolMenuDay[] = [];
    let next: string | null = url;
    for (let i = 0; next && i < MAX_PAGES; i++) {
      const res = await fetch(next, {
        headers: { ...HEADERS, accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`school menus API returned ${res.status}`);
      const page = parseMenusJson(await res.json());
      all.push(...page.days);
      next = page.next;
    }
    return all;
  }
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`school menu page returned ${res.status}`);
  return parseDiningPage(await res.text());
}

let running = false;

export async function syncLunchNow() {
  if (running || !lunchUrl()) return;
  running = true;
  try {
    await syncLunch();
  } catch (err) {
    const offline = networkErrorCode(err);
    // Offline is routine; a parse failure means the school site changed and needs a look.
    if (offline) log('warn', 'lunch', `school menu unreachable (${offline})`);
    else {
      log('error', 'lunch', 'school menu refresh failed', err);
      setSetting('lunch.error', 'changed');
    }
  } finally {
    running = false;
  }
}

// Survives dev hot reloads without stacking loops (same pattern as the calendar sync).
const g = globalThis as { __wallLunchTimer?: ReturnType<typeof setInterval> };
clearInterval(g.__wallLunchTimer);
g.__wallLunchTimer = undefined;

export function ensureLunchLoop() {
  if (g.__wallLunchTimer) return;
  g.__wallLunchTimer = setInterval(syncLunchNow, REFRESH_MS);
  void syncLunchNow();
}

export interface LunchDay {
  day: string;
  /** Entrée choices first, then sides, as posted. */
  lunch: string[];
  breakfast: string[];
  /** e.g. "Fall break" when there's no school. */
  noSchool: string | null;
}

export function lunchBetween(from: string, to: string): LunchDay[] {
  const rows = db()
    .prepare(
      'SELECT day, breakfast, lunch FROM school_menu WHERE day >= ? AND day < ? ORDER BY day',
    )
    .all(from, to) as { day: string; breakfast: string; lunch: string }[];
  return rows.map((r) => {
    const m = { day: r.day, breakfast: JSON.parse(r.breakfast), lunch: JSON.parse(r.lunch) };
    const off = noSchoolLabel(m);
    return {
      day: r.day,
      noSchool: off,
      lunch: off ? [] : m.lunch.map(niceCase),
      breakfast: off ? [] : m.breakfast.map(niceCase),
    };
  });
}
