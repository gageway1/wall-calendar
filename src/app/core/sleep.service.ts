import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { ClockService } from './clock.service';

export interface SleepConfig {
  enabled: boolean;
  /** Minutes since midnight. */
  start: number;
  end: number;
}

const WAKE_MS = 2 * 60 * 1000;
const PREVIEW_MS = 20 * 1000;
const RELOAD_MS = 10 * 60 * 1000;

/** True when `min` (minutes since midnight) falls in [start, end), wrapping past midnight. */
export function inWindow(min: number, start: number, end: number): boolean {
  return start < end ? min >= start && min < end : min >= start || min < end;
}

/**
 * Night mode: a dim, drifting clock between `start` and `end`. A tap wakes the normal screen for
 * two minutes. (Real backlight control happens at the box level; this is the visual part.)
 */
@Injectable({ providedIn: 'root' })
export class SleepService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly clock = inject(ClockService);

  readonly config = signal<SleepConfig>({ enabled: true, start: 22 * 60, end: 6 * 60 });
  private readonly wakeUntil = signal(0);
  private readonly previewUntil = signal(0);
  private readonly timer = setInterval(() => this.load(), RELOAD_MS);

  readonly asleep = computed(() => {
    const now = this.clock.now();
    if (now.getTime() < this.previewUntil()) return true;
    const c = this.config();
    if (!c.enabled || now.getTime() < this.wakeUntil()) return false;
    return inWindow(now.getHours() * 60 + now.getMinutes(), c.start, c.end);
  });

  constructor() {
    this.load();
  }

  load() {
    this.http.get<SleepConfig>('/api/config/sleep').subscribe({
      next: (c) => this.config.set(c),
      error: () => {},
    });
  }

  save(c: SleepConfig) {
    this.config.set(c);
    return this.http.put<SleepConfig>('/api/config/sleep', c);
  }

  wake() {
    this.previewUntil.set(0);
    this.wakeUntil.set(Date.now() + WAKE_MS);
  }

  preview() {
    this.previewUntil.set(Date.now() + PREVIEW_MS);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
