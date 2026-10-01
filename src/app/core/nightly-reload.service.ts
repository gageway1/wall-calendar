import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, timeout } from 'rxjs';
import { PinService } from './pin.service';
import { QuickAddService } from './quick-add.service';
import { TextPromptService } from './text-prompt.service';
import { TimerService } from './timer.service';

const RELOAD_HOUR = 3;
/** If 3am is busy or the server is down, keep trying until 5am, then wait for tomorrow. */
const GIVE_UP_HOUR = 5;
const RETRY_MS = 10 * 60 * 1000;

/** Next local `hour`:00 strictly after `now` (DST-safe: built from calendar fields). */
export function nextRun(now: Date, hour = RELOAD_HOUR): Date {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t;
}

/**
 * Reloads the page once a night so weeks of uptime can't accumulate memory or stale code.
 * One timer per night; never reloads mid-use or while the box's server is down (a reload then
 * would leave Chromium's error page up with nothing to recover from it).
 */
@Injectable({ providedIn: 'root' })
export class NightlyReloadService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly timerSvc = inject(TimerService);
  private readonly quickAdd = inject(QuickAddService);
  private readonly prompt = inject(TextPromptService);
  private readonly pin = inject(PinService);
  private handle?: ReturnType<typeof setTimeout>;
  /** Swappable in tests (location.reload can't be spied on). */
  reload = () => location.reload();

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) this.scheduleAt(nextRun(new Date()));
  }

  private scheduleAt(at: Date) {
    clearTimeout(this.handle);
    this.handle = setTimeout(() => void this.attempt(), Math.max(0, at.getTime() - Date.now()));
  }

  private retryLater() {
    this.scheduleAt(new Date(Date.now() + RETRY_MS));
  }

  private async attempt() {
    const hour = new Date().getHours();
    // Fired late (suspend, throttling) or the clock moved: don't reload in the middle of the day.
    if (hour < RELOAD_HOUR || hour >= GIVE_UP_HOUR) {
      this.scheduleAt(nextRun(new Date()));
      return;
    }
    if (this.busy() || !(await this.serverUp())) {
      this.retryLater();
      return;
    }
    this.reload();
  }

  private busy() {
    return (
      this.timerSvc.active() ||
      this.timerSvc.done() ||
      !!this.quickAdd.request() ||
      !!this.prompt.current() ||
      !!this.pin.request()
    );
  }

  private async serverUp() {
    try {
      await firstValueFrom(this.http.get('/api/health').pipe(timeout(5000)));
      return true;
    } catch {
      return false;
    }
  }

  ngOnDestroy() {
    clearTimeout(this.handle);
  }
}
