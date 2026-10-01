import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ClockService } from './clock.service';
import { Chore, ChoreDay, ChoreItem, Recurrence } from './models';

const REFRESH_MS = 60 * 1000;

export interface ChoreInput {
  personId: number;
  title: string;
  recurrence: Recurrence;
}

/** Today's chore list (with streaks) plus the full chore list for management. */
@Injectable({ providedIn: 'root' })
export class ChoresService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly clock = inject(ClockService);

  readonly today = signal<ChoreDay | null>(null);
  readonly all = signal<Chore[]>([]);

  private readonly timer = setInterval(() => this.refresh(), REFRESH_MS);

  constructor() {
    // Reload when the date flips at midnight.
    effect(() => {
      this.clock.today();
      this.refresh();
    });
  }

  refresh() {
    this.http
      .get<ChoreDay>('/api/chores/day', { params: { day: this.clock.today() } })
      .subscribe({ next: (d) => this.today.set(d), error: () => {} });
    this.http
      .get<Chore[]>('/api/chores')
      .subscribe({ next: (c) => this.all.set(c), error: () => {} });
  }

  /** Check or uncheck, updating the screen right away and rolling back if the save fails. */
  toggle(item: ChoreItem) {
    const day = this.today();
    if (!day) return;
    const done = !item.done;
    this.today.set({
      ...day,
      items: day.items.map((i) =>
        i.id === item.id ? { ...i, done, overdue: done ? false : i.overdue } : i,
      ),
    });

    const url = `/api/chores/${item.id}/done/${day.day}`;
    (done ? this.http.put(url, {}) : this.http.delete(url)).subscribe({
      next: () => this.refresh(), // streaks may have changed
      error: () => this.refresh(),
    });
  }

  create(input: ChoreInput): Observable<Chore> {
    return this.http
      .post<Chore>('/api/chores', { ...input, today: this.clock.today() })
      .pipe(tap(() => this.refresh()));
  }

  update(id: number, input: ChoreInput): Observable<Chore> {
    return this.http.patch<Chore>(`/api/chores/${id}`, input).pipe(tap(() => this.refresh()));
  }

  remove(id: number) {
    return this.http
      .delete(`/api/chores/${id}`, { params: { today: this.clock.today() } })
      .pipe(tap(() => this.refresh()));
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}

const DAY_LETTERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Every day", "Tue & Fri", "Mon, Wed, Fri", "Weekdays", "Once · Oct 2" */
export function describeRecurrence(r: Recurrence): string {
  if (r.kind === 'daily') return 'Every day';
  if (r.kind === 'once') {
    const [y, m, d] = r.date.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    return `Once · ${label}`;
  }
  const days = r.days;
  if (days.length === 7) return 'Every day';
  if (days.join() === '1,2,3,4,5') return 'Weekdays';
  if (days.join() === '0,6') return 'Weekends';
  const names = days.map((d) => DAY_LETTERS[d]);
  return names.length === 2 ? names.join(' & ') : names.join(', ');
}
