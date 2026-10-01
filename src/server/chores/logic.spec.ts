import {
  Chore,
  isShownOn,
  parseRecurrence,
  recurrenceFromInput,
  repeatsOn,
  streak,
  weekday,
} from './logic';

const chore = (over: Partial<Chore>): Chore => ({
  id: 1,
  personId: 1,
  title: 'Feed the dog',
  recurrence: { kind: 'daily' },
  createdOn: '2026-09-01',
  archivedOn: null,
  ...over,
});

// 2026-09-30 is a Wednesday.
describe('recurrence', () => {
  it('parses and validates', () => {
    expect(parseRecurrence('daily')).toEqual({ kind: 'daily' });
    expect(parseRecurrence('weekly:5,2,2')).toEqual({ kind: 'weekly', days: [2, 5] });
    expect(parseRecurrence('once:2026-10-02')).toEqual({ kind: 'once', date: '2026-10-02' });
    expect(parseRecurrence('garbage')).toEqual({ kind: 'daily' });
    expect(recurrenceFromInput({ kind: 'weekly', days: [9] })).toBeNull();
    expect(recurrenceFromInput({ kind: 'weekly', days: [] })).toBeNull();
    expect(recurrenceFromInput({ kind: 'once', date: 'tomorrow' })).toBeNull();
    expect(recurrenceFromInput({ kind: 'weekly', days: [1, 3] })).toEqual({
      kind: 'weekly',
      days: [1, 3],
    });
  });

  it('weekday() uses the local calendar date', () => {
    expect(weekday('2026-09-30')).toBe(3);
    expect(weekday('2026-10-04')).toBe(0);
  });

  it('repeating chores respect weekdays, creation and archive dates', () => {
    const trash = chore({ recurrence: { kind: 'weekly', days: [2, 5] } });
    expect(repeatsOn(trash, '2026-09-29')).toBe(true); // Tue
    expect(repeatsOn(trash, '2026-09-30')).toBe(false); // Wed
    expect(repeatsOn(chore({ createdOn: '2026-09-30' }), '2026-09-29')).toBe(false);
    expect(repeatsOn(chore({ archivedOn: '2026-09-30' }), '2026-09-30')).toBe(false);
    expect(repeatsOn(chore({ archivedOn: '2026-09-30' }), '2026-09-29')).toBe(true);
  });

  it('one-time tasks carry over until done, then show only on the day they were done', () => {
    const garage = chore({ recurrence: { kind: 'once', date: '2026-09-28' } });
    expect(isShownOn(garage, '2026-09-27', undefined)).toBe(false);
    expect(isShownOn(garage, '2026-09-28', undefined)).toBe(true);
    expect(isShownOn(garage, '2026-09-30', undefined)).toBe(true); // overdue, still listed
    expect(isShownOn(garage, '2026-09-30', '2026-09-30')).toBe(true);
    expect(isShownOn(garage, '2026-10-01', '2026-09-30')).toBe(false);
  });
});

describe('streak', () => {
  const dog = chore({ id: 1 });
  const trash = chore({ id: 2, recurrence: { kind: 'weekly', days: [2] } }); // Tuesdays
  const done = (...keys: string[]) => new Set(keys);

  it('counts consecutive complete days; unfinished today does not break it', () => {
    const d = done('1:2026-09-27', '1:2026-09-28', '1:2026-09-29', '2:2026-09-29');
    expect(streak([dog, trash], d, '2026-09-30')).toBe(3);
  });

  it('today counts once complete', () => {
    const d = done('1:2026-09-29', '2:2026-09-29', '1:2026-09-30');
    expect(streak([dog, trash], d, '2026-09-30')).toBe(2);
  });

  it('a missed chore yesterday breaks it', () => {
    const d = done('1:2026-09-28', '1:2026-09-29'); // trash missed on Tue 29th
    expect(streak([dog, trash], d, '2026-09-30')).toBe(0);
  });

  it('days with nothing due are skipped, not breaks', () => {
    const tueOnly = chore({ id: 2, recurrence: { kind: 'weekly', days: [2] } });
    const d = done('2:2026-09-22', '2:2026-09-29');
    expect(streak([tueOnly], d, '2026-09-30')).toBe(2);
  });

  it('one-time tasks never affect streaks', () => {
    const garage = chore({ id: 3, recurrence: { kind: 'once', date: '2026-09-20' } });
    const d = done('1:2026-09-29');
    expect(streak([dog, garage], d, '2026-09-30')).toBe(1);
    expect(streak([garage], d, '2026-09-30')).toBe(0);
  });

  it('stops at the earliest creation date', () => {
    const fresh = chore({ id: 1, createdOn: '2026-09-29' });
    expect(streak([fresh], done('1:2026-09-29', '1:2026-09-30'), '2026-09-30')).toBe(2);
  });
});
