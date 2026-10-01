/** Chore scheduling and streaks. Pure functions over YYYY-MM-DD local dates; no DB access. */

export type Recurrence =
  | { kind: 'daily' }
  | { kind: 'weekly'; days: number[] } // 0 = Sunday
  | { kind: 'once'; date: string };

export interface Chore {
  id: number;
  personId: number;
  title: string;
  recurrence: Recurrence;
  /** First day it applies. */
  createdOn: string;
  /** Removed from this day on; past days keep counting for streaks. */
  archivedOn: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STREAK_DAYS = 366;

export function parseRecurrence(s: string): Recurrence {
  if (s.startsWith('weekly:')) {
    const days = [...new Set(s.slice(7).split(',').filter(Boolean).map(Number))]
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      .sort();
    return days.length ? { kind: 'weekly', days } : { kind: 'daily' };
  }
  if (s.startsWith('once:') && DATE.test(s.slice(5))) return { kind: 'once', date: s.slice(5) };
  return { kind: 'daily' };
}

export function formatRecurrence(r: Recurrence): string {
  if (r.kind === 'weekly') return `weekly:${r.days.join(',')}`;
  if (r.kind === 'once') return `once:${r.date}`;
  return 'daily';
}

/** Validates client input; returns null if malformed. */
export function recurrenceFromInput(input: unknown): Recurrence | null {
  const r = input as Partial<Recurrence> | null;
  if (r?.kind === 'daily') return { kind: 'daily' };
  if (r?.kind === 'weekly' && Array.isArray(r.days)) {
    const parsed = parseRecurrence(`weekly:${r.days.join(',')}`);
    return parsed.kind === 'weekly' ? parsed : null;
  }
  if (r?.kind === 'once' && typeof r.date === 'string' && DATE.test(r.date)) {
    return { kind: 'once', date: r.date };
  }
  return null;
}

export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function addDay(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/** Does a repeating chore apply on `day`? (One-time tasks are handled by `isShownOn`.) */
export function repeatsOn(c: Chore, day: string): boolean {
  if (c.recurrence.kind === 'once') return false;
  if (day < c.createdOn || (c.archivedOn && day >= c.archivedOn)) return false;
  return c.recurrence.kind === 'daily' || c.recurrence.days.includes(weekday(day));
}

/**
 * Should the chore appear on `day`'s list? Repeating: when it repeats. One-time: from its date
 * until it's done (carrying over), and on the day it was done.
 * `doneOn` = the day a one-time task was completed, if ever.
 */
export function isShownOn(c: Chore, day: string, doneOn: string | undefined): boolean {
  if (c.recurrence.kind !== 'once') return repeatsOn(c, day);
  if (c.archivedOn && day >= c.archivedOn) return false;
  if (doneOn) return doneOn === day;
  return c.recurrence.date <= day;
}

/**
 * Days in a row a person finished all their repeating chores. Today counts only once complete,
 * and an unfinished today doesn't break the streak (the day isn't over). Days with nothing due
 * are skipped: they neither break nor extend it.
 */
export function streak(chores: Chore[], done: Set<string>, today: string): number {
  const repeating = chores.filter((c) => c.recurrence.kind !== 'once');
  if (!repeating.length) return 0;
  const earliest = repeating.reduce((min, c) => (c.createdOn < min ? c.createdOn : min), today);

  let count = 0;
  let day = today;
  for (let i = 0; i < MAX_STREAK_DAYS && day >= earliest; i++, day = addDay(day, -1)) {
    const due = repeating.filter((c) => repeatsOn(c, day));
    if (!due.length) continue;
    const complete = due.every((c) => done.has(`${c.id}:${day}`));
    if (complete) count++;
    else if (day !== today) break;
  }
  return count;
}
