import type { GEvent } from './calendar-api';

export interface EventRow {
  google_event_id: string;
  calendar_id: string;
  title: string;
  location: string | null;
  description: string | null;
  /** Timed: UTC ISO string. All-day: YYYY-MM-DD (end is exclusive, as Google sends it). */
  start_at: string;
  end_at: string;
  all_day: 0 | 1;
  recurring: 0 | 1;
  updated_at: string;
}

/** Google event → cache row. Returns null for cancelled or malformed events. */
export function toEventRow(calendarId: string, e: GEvent): EventRow | null {
  if (e.status === 'cancelled' || !e.start || !e.end) return null;

  const allDay = !!e.start.date;
  const start = allDay
    ? e.start.date
    : e.start.dateTime && new Date(e.start.dateTime).toISOString();
  const end = allDay ? e.end.date : e.end.dateTime && new Date(e.end.dateTime).toISOString();
  if (!start || !end) return null;

  return {
    google_event_id: e.id,
    calendar_id: calendarId,
    title: e.summary?.trim() || '(No title)',
    location: e.location ?? null,
    description: e.description ?? null,
    start_at: start,
    end_at: end,
    all_day: allDay ? 1 : 0,
    recurring: e.recurringEventId ? 1 : 0,
    updated_at: e.updated ?? new Date().toISOString(),
  };
}
