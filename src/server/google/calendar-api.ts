import { GoogleError, getAccessToken } from './oauth';

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

async function gapi<T>(
  path: string,
  query: Record<string, string | undefined> = {},
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body !== undefined && { 'content-type': 'application/json' }),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new GoogleError(String(res.status), body?.error?.message);
  }
  return (res.status === 204 ? undefined : res.json()) as Promise<T>;
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
