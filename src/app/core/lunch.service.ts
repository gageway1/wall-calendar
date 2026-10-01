import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, Signal, effect, inject, signal } from '@angular/core';
import { DayKey } from './date';
import { PeopleService } from './people.service';

export interface LunchDay {
  day: DayKey;
  /** Entrée choices first, then sides. */
  lunch: string[];
  breakfast: string[];
  noSchool: string | null;
}

export interface LunchConfig {
  url: string;
  personId: number | null;
  lastSyncAt: string | null;
  broken: boolean;
  days: number;
  through: string | null;
}

const REFRESH_MS = 30 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class LunchService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly people = inject(PeopleService);

  readonly config = signal<LunchConfig | null>(null);
  private readonly version = signal(0);
  private readonly timer = setInterval(() => this.refresh(), REFRESH_MS);

  constructor() {
    this.loadConfig();
  }

  loadConfig() {
    this.http.get<LunchConfig>('/api/lunch/config').subscribe({
      next: (c) => this.config.set(c),
      error: () => {},
    });
  }

  refresh() {
    this.version.update((v) => v + 1);
  }

  /** "Skylar's lunch" if a person is set, else "School lunch". */
  label(): string {
    const id = this.config()?.personId;
    const name = this.people.people().find((p) => p.id === id)?.name;
    return name ? `${name}'s lunch` : 'School lunch';
  }

  /** Menus for [from, to); call from an injection context. */
  watchRange(range: () => { from: DayKey; to: DayKey }): Signal<LunchDay[]> {
    const out = signal<LunchDay[]>([]);
    effect((onCleanup) => {
      const r = range();
      this.version();
      const sub = this.http.get<LunchDay[]>('/api/lunch', { params: r }).subscribe({
        next: (days) => out.set(days),
        error: () => {},
      });
      onCleanup(() => sub.unsubscribe());
    });
    return out.asReadonly();
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}

/** The day's entrée choices: "Uncrustable basket or rotini and breadstick". */
export function entrees(day: LunchDay, max = 2): string {
  return (
    day.lunch
      .slice(0, max)
      // Lowercase the second choice's first letter ("…or hamburger"), but not abbreviations ("BBQ").
      .map((item, i) =>
        i === 0 || /^[A-Z]{2}/.test(item) ? item : item.charAt(0).toLowerCase() + item.slice(1),
      )
      .join(' or ')
  );
}
