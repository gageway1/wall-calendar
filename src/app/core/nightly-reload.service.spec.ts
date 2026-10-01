import { nextRun } from './nightly-reload.service';

const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

describe('nextRun', () => {
  it('is later today when it is before 3am', () => {
    expect(nextRun(local(2026, 10, 1, 1, 30))).toEqual(local(2026, 10, 1, 3));
  });

  it('is tomorrow when it is 3am or later (no reload loop after reloading at 3:00)', () => {
    expect(nextRun(local(2026, 10, 1, 3, 0))).toEqual(local(2026, 10, 2, 3));
    expect(nextRun(local(2026, 10, 1, 3, 0))).not.toEqual(local(2026, 10, 1, 3));
    expect(nextRun(local(2026, 10, 1, 15))).toEqual(local(2026, 10, 2, 3));
  });

  it('rolls over months and years', () => {
    expect(nextRun(local(2026, 12, 31, 22))).toEqual(local(2027, 1, 1, 3));
  });

  it('lands on local 3am across a DST change', () => {
    // US fall-back is 2026-11-01; spring-forward is 2027-03-14.
    expect(nextRun(local(2026, 10, 31, 23)).getHours()).toBe(3);
    expect(nextRun(local(2027, 3, 13, 23)).getHours()).toBe(3);
  });
});

import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NightlyReloadService } from './nightly-reload.service';
import { QuickAddService } from './quick-add.service';

describe('NightlyReloadService', () => {
  let svc: NightlyReloadService;
  let reloads: number;
  /** The box's server: answers health checks instantly, up or down. */
  let serverUp = true;
  const fakeHttp = {
    get: () => (serverUp ? of({ ok: true }) : throwError(() => new Error('server down'))),
  };

  const start = (now: Date) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    serverUp = true;
    TestBed.configureTestingModule({ providers: [{ provide: HttpClient, useValue: fakeHttp }] });
    svc = TestBed.inject(NightlyReloadService);
    reloads = 0;
    svc.reload = () => void reloads++;
  };
  const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  afterEach(() => vi.useRealTimers());

  it('reloads once at 3am when idle and the server answers', async () => {
    start(local(2026, 10, 1, 2, 50));
    await advance(9 * 60_000);
    expect(reloads).toBe(0);
    await advance(2 * 60_000);
    expect(reloads).toBe(1);
  });

  it('waits while a popup is open, then reloads once it closes', async () => {
    start(local(2026, 10, 1, 2, 59));
    TestBed.inject(QuickAddService).open();
    await advance(5 * 60_000);
    expect(reloads).toBe(0);
    TestBed.inject(QuickAddService).close();
    await advance(10 * 60_000);
    expect(reloads).toBe(1);
  });

  it('never reloads while the server is down (would strand an error page)', async () => {
    start(local(2026, 10, 1, 2, 59));
    serverUp = false;
    await advance(30 * 60_000);
    expect(reloads).toBe(0);
    serverUp = true;
    await advance(10 * 60_000);
    expect(reloads).toBe(1);
  });

  it('gives up at 5am and tries again the next night', async () => {
    start(local(2026, 10, 1, 2, 59));
    serverUp = false;
    await advance(3 * 60 * 60_000); // through 6am
    expect(reloads).toBe(0);
    serverUp = true;
    await advance(12 * 60 * 60_000); // daytime: nothing
    expect(reloads).toBe(0);
    await advance(10 * 60 * 60_000); // through the next 3am
    expect(reloads).toBe(1);
  });
});
