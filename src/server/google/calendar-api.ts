import { googleRequest } from './http';
import { GoogleError } from './oauth';

const API = 'https://www.googleapis.com/calendar/v3';

export interface GCalendarListEntry {
  id: string;
  summary: string;
  summaryOverride?: string;
  backgroundColor?: string;
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  primary?: boolean;
}

export interface GEventTime {
  date?: string; // all-day: YYYY-MM-DD
  dateTime?: string; // timed: RFC3339 with offset
  timeZone?: string;
}

export interface GEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  location?: string;
  description?: string;
  start?: GEventTime;
  end?: GEventTime;
  updated?: string;
  recurringEventId?: string;
}

/** Fields the wall can set. `null` clears a field on PATCH (e.g. switching all-day ↔ timed). */
export interface GEventWrite {
  summary?: string;
  start?: { date?: string | null; dateTime?: string | null; timeZone?: string | null };
  end?: { date?: string | null; dateTime?: string | null; timeZone?: string | null };
}

function gapi<T>(
  path: string,
  query: Record<string, string | undefined> = {},
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  return googleRequest<T>(API + path, query, init);
}

const eventsPath = (calendarId: string, eventId?: string) =>
  `/calendars/${encodeURIComponent(calendarId)}/events` +
  (eventId ? `/${encodeURIComponent(eventId)}` : '');

async function paged<T>(path: string, query: Record<string, string | undefined>): Promise<T[]> {
  const all: T[] = [];
  let pageToken: string | undefined;
  do {
    const page = await gapi<{ items?: T[]; nextPageToken?: string }>(path, { ...query, pageToken });
    all.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return all;
}

export function listCalendars() {
  return paged<GCalendarListEntry>('/users/me/calendarList', { maxResults: '250' });
}

/** All event instances (recurrences expanded) overlapping [timeMin, timeMax). */
export function listEvents(calendarId: string, timeMin: Date, timeMax: Date) {
  return paged<GEvent>(eventsPath(calendarId), {
    singleEvents: 'true',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: '2500',
  });
}

export function insertEvent(calendarId: string, body: GEventWrite) {
  return gapi<GEvent>(eventsPath(calendarId), {}, { method: 'POST', body });
}

export function patchEvent(calendarId: string, eventId: string, body: GEventWrite) {
  return gapi<GEvent>(eventsPath(calendarId, eventId), {}, { method: 'PATCH', body });
}

/** Moves an event to another calendar (i.e. another person). Returns the moved event. */
export function moveEvent(calendarId: string, eventId: string, destination: string) {
  return gapi<GEvent>(
    `${eventsPath(calendarId, eventId)}/move`,
    { destination },
    { method: 'POST' },
  );
}

export async function deleteEvent(calendarId: string, eventId: string) {
  try {
    await gapi<void>(eventsPath(calendarId, eventId), {}, { method: 'DELETE' });
  } catch (err) {
    // Already gone (deleted in Google since our last sync) is the outcome we wanted.
    if (err instanceof GoogleError && (err.code === '404' || err.code === '410')) return;
    throw err;
  }
}
