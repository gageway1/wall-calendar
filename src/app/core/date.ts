import type { CalEvent } from './models';

/** A local calendar date as YYYY-MM-DD. */
export type DayKey = string;

export function dayKey(d: Date): DayKey {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight for a DayKey (never `new Date('YYYY-MM-DD')`, which is UTC). */
export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function startOfWeek(d: Date, weekStartsOn = 0): Date {
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function eventOnDay(ev: CalEvent, key: DayKey): boolean {
  if (ev.allDay) return ev.start <= key && key < ev.end;
  const dayStart = parseDay(key).getTime();
  const dayEnd = addDays(parseDay(key), 1).getTime();
  return new Date(ev.start).getTime() < dayEnd && new Date(ev.end).getTime() > dayStart;
}

/** Events touching a day: all-day first, then by start time. */
export function eventsForDay(events: CalEvent[], key: DayKey): CalEvent[] {
  return events
    .filter((e) => eventOnDay(e, key))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
}

/** 9am, 9:30am, 12pm */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  const suffix = d.getHours() < 12 ? 'am' : 'pm';
  return m ? `${h}:${String(m).padStart(2, '0')}${suffix}` : `${h}${suffix}`;
}

/** Short label for a pill on a given day: start time, or "cont." if it began on an earlier day. */
export function pillTime(ev: CalEvent, key: DayKey): string {
  if (ev.allDay) return '';
  return new Date(ev.start) < parseDay(key) ? 'cont.' : formatTime(ev.start);
}

const fmtDay = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

/** Full human description of when an event happens, for the detail dialog. */
export function describeWhen(ev: CalEvent): string {
  if (ev.allDay) {
    const start = parseDay(ev.start);
    const lastDay = addDays(parseDay(ev.end), -1);
    return dayKey(start) === dayKey(lastDay)
      ? `${fmtDay.format(start)} · All day`
      : `${fmtDay.format(start)} – ${fmtDay.format(lastDay)}`;
  }
  const start = new Date(ev.start);
  const end = new Date(ev.end);
  return dayKey(start) === dayKey(end)
    ? `${fmtDay.format(start)} · ${formatTime(ev.start)} – ${formatTime(ev.end)}`
    : `${fmtDay.format(start)} ${formatTime(ev.start)} – ${fmtDay.format(end)} ${formatTime(ev.end)}`;
}

/** Minutes since midnight → 12:00pm */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
}

/** 90 → "1 hr 30 min" */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ') || '0 min';
}

/** Whole days from a to b (DST-safe). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** Local date + minutes since midnight → Date (DST-safe). */
export function atMinutes(key: DayKey, min: number): Date {
  const d = parseDay(key);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, min);
}
