import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Person } from './models';

const HIDDEN_KEY = 'wall.hiddenPeople';

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly http = inject(HttpClient);

  readonly people = signal<Person[]>([]);
  /** People with a Google calendar: the ones who can have events. */
  readonly withCalendar = computed(() => this.people().filter((p) => p.calendarId !== null));
  /** People who get chores (not holidays or shared family calendars). */
  readonly withChores = computed(() => this.people().filter((p) => p.hasChores));
  /** People filtered out of the views. Remembered per browser. */
  readonly hidden = signal<ReadonlySet<number>>(loadHidden());

  constructor() {
    this.load();
  }

  load() {
    this.http.get<Person[]>('/api/people').subscribe({
      next: (p) => this.people.set(p),
      // Surfaced by the HTTP interceptor; keep the last list.
      error: () => {},
    });
  }

  toggle(id: number) {
    const next = new Set(this.hidden());
    if (!next.delete(id)) next.add(id);
    this.hidden.set(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {}
  }

  create(body: {
    name: string;
    color: string;
    calendarId?: string | null;
    accessRole?: string;
  }): Observable<Person> {
    return this.http.post<Person>('/api/people', body).pipe(tap(() => this.load()));
  }

  /** `calendarId: null` unlinks; a string links that calendar. */
  update(
    id: number,
    body: Partial<Pick<Person, 'name' | 'color' | 'sortOrder' | 'calendarId' | 'hasChores'>> & {
      accessRole?: string;
    },
  ) {
    return this.http.patch<Person>(`/api/people/${id}`, body).pipe(tap(() => this.load()));
  }

  /** First palette color nobody uses yet. */
  nextColor(palette: readonly string[]) {
    const used = new Set(this.people().map((p) => p.color));
    return palette.find((c) => !used.has(c)) ?? palette[this.people().length % palette.length];
  }

  remove(id: number) {
    return this.http.delete(`/api/people/${id}`).pipe(tap(() => this.load()));
  }
}

function loadHidden(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}
