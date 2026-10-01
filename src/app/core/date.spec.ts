import {
  addDays,
  atMinutes,
  daysBetween,
  formatDuration,
  formatMinutes,
  dayKey,
  eventOnDay,
  eventsForDay,
  formatTime,
  parseDay,
  pillTime,
  startOfWeek,
} from './date';
import { CalEvent } from './models';

const ev = (over: Partial<CalEvent>): CalEvent => ({
  id: 'x',
  eventId: 'x',
  calendarId: 'c',
  title: 't',
  location: null,
  description: null,
  start: '',
  end: '',
  allDay: false,
  recurring: false,
  personId: 1,
  personName: 'P',
  color: '#000000',
  ...over,
});

/** Local wall-clock time → UTC ISO, the way the API sends timed events. */
const at = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  new Date(y, mo - 1, d, h, mi).toISOString();

describe('date helpers', () => {
  it('parseDay/dayKey round-trip in local time', () => {
    expect(dayKey(parseDay('2026-03-08'))).toBe('2026-03-08');
    expect(parseDay('2026-03-08').getHours()).toBe(0);
  });

  it('addDays crosses month and year boundaries', () => {
    expect(dayKey(addDays(parseDay('2026-12-30'), 3))).toBe('2027-01-02');
  });

  it('startOfWeek defaults to Sunday', () => {
    expect(dayKey(startOfWeek(parseDay('2026-09-30')))).toBe('2026-09-27');
    expect(dayKey(startOfWeek(parseDay('2026-09-27')))).toBe('2026-09-27');
    expect(dayKey(startOfWeek(parseDay('2026-09-30'), 1))).toBe('2026-09-28');
  });

  it('all-day events use an exclusive end date', () => {
    const e = ev({ allDay: true, start: '2026-09-30', end: '2026-10-02' });
    expect(eventOnDay(e, '2026-09-29')).toBe(false);
    expect(eventOnDay(e, '2026-09-30')).toBe(true);
    expect(eventOnDay(e, '2026-10-01')).toBe(true);
    expect(eventOnDay(e, '2026-10-02')).toBe(false);
  });

  it('timed events overlap by local day, and ending at midnight does not spill over', () => {
    const e = ev({ start: at(2026, 9, 30, 22), end: at(2026, 10, 1, 0) });
    expect(eventOnDay(e, '2026-09-30')).toBe(true);
    expect(eventOnDay(e, '2026-10-01')).toBe(false);

    const overnight = ev({ start: at(2026, 9, 30, 22), end: at(2026, 10, 1, 2) });
    expect(eventOnDay(overnight, '2026-10-01')).toBe(true);
    expect(pillTime(overnight, '2026-09-30')).toBe('10pm');
    expect(pillTime(overnight, '2026-10-01')).toBe('cont.');
  });

  it('sorts all-day first, then by start', () => {
    const late = ev({ id: 'late', start: at(2026, 9, 30, 15), end: at(2026, 9, 30, 16) });
    const early = ev({ id: 'early', start: at(2026, 9, 30, 8), end: at(2026, 9, 30, 9) });
    const allDay = ev({ id: 'all', allDay: true, start: '2026-09-30', end: '2026-10-01' });
    expect(eventsForDay([late, early, allDay], '2026-09-30').map((e) => e.id)).toEqual([
      'all',
      'early',
      'late',
    ]);
  });

  it('formatTime is compact', () => {
    expect(formatTime(at(2026, 1, 1, 9))).toBe('9am');
    expect(formatTime(at(2026, 1, 1, 9, 30))).toBe('9:30am');
    expect(formatTime(at(2026, 1, 1, 12))).toBe('12pm');
    expect(formatTime(at(2026, 1, 1, 0, 5))).toBe('12:05am');
  });

  it('quick-add time helpers', () => {
    expect(formatMinutes(720)).toBe('12:00pm');
    expect(formatMinutes(0)).toBe('12:00am');
    expect(formatMinutes(13 * 60 + 45)).toBe('1:45pm');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(90)).toBe('1 hr 30 min');
    expect(formatDuration(15)).toBe('15 min');
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(atMinutes('2026-10-01', 750).getHours()).toBe(12);
    expect(atMinutes('2026-10-01', 750).getMinutes()).toBe(30);
    // Past midnight rolls into the next day.
    expect(dayKey(atMinutes('2026-10-01', 25 * 60))).toBe('2026-10-02');
  });
});
