import { parseEventInput, toGoogleInsert, toGooglePatch } from './event-input';

const timed = {
  personId: 3,
  title: ' Soccer ',
  allDay: false,
  start: '2026-09-30T18:15:00.000Z',
  end: '2026-09-30T19:45:00.000Z',
};
const allDay = { personId: 1, title: 'Trip', allDay: true, start: '2026-09-19', end: '2026-09-22' };

describe('parseEventInput', () => {
  it('accepts and trims valid input', () => {
    expect(parseEventInput(timed)).toEqual({ ...timed, title: 'Soccer' });
    expect(parseEventInput(allDay)).toEqual(allDay);
  });

  it('rejects bad input with a message', () => {
    expect(parseEventInput(null)).toBe('personId is required');
    expect(parseEventInput({ ...timed, title: '   ' })).toBe('title is required');
    expect(parseEventInput({ ...timed, title: 'x'.repeat(201) })).toMatch(/200 characters/);
    expect(parseEventInput({ ...timed, allDay: 'no' })).toBe('allDay must be a boolean');
    expect(parseEventInput({ ...timed, end: timed.start })).toBe('end must be after start');
    expect(parseEventInput({ ...timed, start: 'noon' })).toBe('start/end must be ISO timestamps');
    expect(parseEventInput({ ...allDay, end: '2026-09-19' })).toBe('end must be after start');
    expect(parseEventInput({ ...allDay, start: '9/19' })).toBe(
      'all-day start/end must be YYYY-MM-DD',
    );
  });
});

describe('Google bodies', () => {
  const tz = 'America/New_York';

  it('timed insert sets dateTime + timeZone only', () => {
    const input = parseEventInput(timed);
    if (typeof input === 'string') throw new Error(input);
    expect(toGoogleInsert(input, tz)).toEqual({
      summary: 'Soccer',
      start: { dateTime: '2026-09-30T18:15:00.000Z', timeZone: tz },
      end: { dateTime: '2026-09-30T19:45:00.000Z', timeZone: tz },
    });
  });

  it('all-day insert sets date only', () => {
    const input = parseEventInput(allDay);
    if (typeof input === 'string') throw new Error(input);
    expect(toGoogleInsert(input, tz)).toEqual({
      summary: 'Trip',
      start: { date: '2026-09-19' },
      end: { date: '2026-09-22' },
    });
  });

  it('patch clears the other representation', () => {
    const input = parseEventInput(allDay);
    if (typeof input === 'string') throw new Error(input);
    expect(toGooglePatch(input, tz).start).toEqual({
      date: '2026-09-19',
      dateTime: null,
      timeZone: null,
    });
  });
});
