import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { dayKey } from './date';

/** App-wide ticking clock. Also exposes `today` (YYYY-MM-DD, local) which flips at midnight. */
@Injectable({ providedIn: 'root' })
export class ClockService implements OnDestroy {
  readonly now = signal(new Date());
  readonly today = computed(() => dayKey(this.now()));

  private readonly timer = setInterval(() => this.now.set(new Date()), 1000);

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
