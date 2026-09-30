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
}

async function gapi<T>(path: string, query: Record<string, string | undefined> = {}): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new GoogleError(String(res.status), body?.error?.message);
  }
  return res.json() as Promise<T>;
}

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
  return paged<GEvent>(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    singleEvents: 'true',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: '2500',
  });
}
