import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, Signal, computed, effect, inject, signal } from '@angular/core';
import { DayKey } from './date';
import { CalEvent } from './models';
import { PeopleService } from './people.service';

const REFRESH_MS = 60 * 1000;

@Injectable({ providedIn: 'root' })
export class EventsService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly people = inject(PeopleService);

  /** Bumped on a timer and after edits; every watched range refetches when it changes. */
  private readonly version = signal(0);
  private readonly timer = setInterval(() => this.refresh(), REFRESH_MS);

  refresh() {
    this.version.update((v) => v + 1);
  }

  /**
   * Live, person-filtered events for a date range ([from, to), local days).
   * Call from an injection context (e.g. a component field); it stops with that component.
   */
  watchRange(range: () => { from: DayKey; to: DayKey }): Signal<CalEvent[]> {
    const raw = signal<CalEvent[]>([]);
    let lastKey = '';

    effect((onCleanup) => {
      const r = range();
      this.version();

      // Moving to a different range: drop stale events instead of showing last week's.
      const key = `${r.from}/${r.to}`;
      if (key !== lastKey) {
        raw.set([]);
        lastKey = key;
      }

      const sub = this.http.get<CalEvent[]>('/api/events', { params: r }).subscribe({
        next: (events) => raw.set(events),
        error: (err) => console.warn('[events] refresh failed', err.status),
      });
      onCleanup(() => sub.unsubscribe());
    });

    return computed(() => {
      const hidden = this.people.hidden();
      return raw().filter((e) => !hidden.has(e.personId));
    });
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
