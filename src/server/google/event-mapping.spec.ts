import { toEventRow } from './event-mapping';

describe('toEventRow', () => {
  it('normalizes timed events to UTC ISO', () => {
    const row = toEventRow('cal', {
      id: 'e1',
      summary: ' Soccer ',
      start: { dateTime: '2026-10-01T17:30:00-05:00' },
      end: { dateTime: '2026-10-01T19:00:00-05:00' },
    });
    expect(row).toMatchObject({
      google_event_id: 'e1',
      calendar_id: 'cal',
      title: 'Soccer',
      start_at: '2026-10-01T22:30:00.000Z',
      end_at: '2026-10-02T00:00:00.000Z',
      all_day: 0,
    });
  });

  it('keeps all-day dates as-is', () => {
    const row = toEventRow('cal', {
      id: 'e2',
      start: { date: '2026-10-01' },
      end: { date: '2026-10-02' },
    });
    expect(row).toMatchObject({
      start_at: '2026-10-01',
      end_at: '2026-10-02',
      all_day: 1,
      title: '(No title)',
    });
  });

  it('drops cancelled and malformed events', () => {
    expect(
      toEventRow('cal', {
        id: 'c',
        status: 'cancelled',
        start: { date: '2026-10-01' },
        end: { date: '2026-10-02' },
      }),
    ).toBeNull();
    expect(toEventRow('cal', { id: 'm', start: {}, end: {} })).toBeNull();
  });
});
