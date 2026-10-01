import type { GEventWrite } from './calendar-api';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TITLE = 200;

export interface EventInput {
  personId: number;
  title: string;
  allDay: boolean;
  /** All-day: YYYY-MM-DD, end exclusive. Timed: ISO instants. */
  start: string;
  end: string;
}

/** Validates a create/edit request body; returns an error message or the parsed input. */
export function parseEventInput(body: any): EventInput | string {
  const { personId, title, allDay, start, end } = body ?? {};
  if (!Number.isInteger(personId)) return 'personId is required';
  if (typeof title !== 'string' || !title.trim()) return 'title is required';
  if (title.length > MAX_TITLE) return `title must be ${MAX_TITLE} characters or fewer`;
  if (typeof allDay !== 'boolean') return 'allDay must be a boolean';
  if (typeof start !== 'string' || typeof end !== 'string') return 'start and end are required';

  if (allDay) {
    if (!DATE.test(start) || !DATE.test(end)) return 'all-day start/end must be YYYY-MM-DD';
    if (end <= start) return 'end must be after start';
  } else {
    const s = Date.parse(start);
    const e = Date.parse(end);
    if (Number.isNaN(s) || Number.isNaN(e)) return 'start/end must be ISO timestamps';
    if (e <= s) return 'end must be after start';
  }
  return { personId, title: title.trim(), allDay, start, end };
}

/**
 * Google event body for a PATCH. Nulls clear the other representation, so switching an event
 * between all-day and timed doesn't leave both `date` and `dateTime` set.
 */
export function toGooglePatch(input: EventInput, timeZone: string): GEventWrite {
  return input.allDay
    ? {
        summary: input.title,
        start: { date: input.start, dateTime: null, timeZone: null },
        end: { date: input.end, dateTime: null, timeZone: null },
      }
    : {
        summary: input.title,
        start: { dateTime: new Date(input.start).toISOString(), date: null, timeZone },
        end: { dateTime: new Date(input.end).toISOString(), date: null, timeZone },
      };
}

/** Google event body for an insert: same as the patch, minus the nulls (meaningless on create). */
export function toGoogleInsert(input: EventInput, timeZone: string): GEventWrite {
  const body = toGooglePatch(input, timeZone);
  const clean = (t: GEventWrite['start']) =>
    t && Object.fromEntries(Object.entries(t).filter(([, v]) => v !== null));
  return { ...body, start: clean(body.start), end: clean(body.end) };
}
