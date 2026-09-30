import { Injectable, OnDestroy, computed, signal } from '@angular/core';

/** App-wide ticking clock. Also exposes `today` (YYYY-MM-DD, local) which flips at midnight. */
@Injectable({ providedIn: 'root' })
export class ClockService implements OnDestroy {
  readonly now = signal(new Date());
  readonly today = computed(() => toLocalDate(this.now()));

  private readonly timer = setInterval(() => this.now.set(new Date()), 1000);

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}

export function toLocalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
