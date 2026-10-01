export interface Person {
  id: number;
  name: string;
  color: string;
  calendarId: string | null;
  sortOrder: number;
  /** False when the calendar is shared view-only with the household account. */
  canWrite: boolean;
}

export interface CalEvent {
  /** `${calendarId}/${eventId}`, unique across calendars. */
  id: string;
  eventId: string;
  calendarId: string;
  title: string;
  location: string | null;
  description: string | null;
  /** Timed: UTC ISO. All-day: YYYY-MM-DD, `end` exclusive. */
  start: string;
  end: string;
  allDay: boolean;
  /** One occurrence of a repeating series; edits apply to this occurrence only. */
  recurring: boolean;
  personId: number;
  personName: string;
  color: string;
}

export interface TitleSuggestion {
  title: string;
  personId: number;
  count: number;
}

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  account: string | null;
  error: string | null;
  lastSyncAt: string | null;
}

export interface GoogleCalendar {
  id: string;
  name: string;
  color: string | null;
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  primary: boolean;
}

/** Distinct on the dark theme and from each other. */
export const PERSON_COLORS = [
  '#4f9dff',
  '#ff6b6b',
  '#51cf66',
  '#b197fc',
  '#ff922b',
  '#f06595',
  '#22b8cf',
  '#fcc419',
];
