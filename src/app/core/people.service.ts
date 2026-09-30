import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Person } from './models';

const HIDDEN_KEY = 'wall.hiddenPeople';

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly http = inject(HttpClient);

  readonly people = signal<Person[]>([]);
  /** People filtered out of the views. Per-screen, so the wall and a phone can differ. */
  readonly hidden = signal<ReadonlySet<number>>(loadHidden());

  constructor() {
    this.load();
  }

  load() {
    this.http.get<Person[]>('/api/people').subscribe((p) => this.people.set(p));
  }

  toggle(id: number) {
    const next = new Set(this.hidden());
    if (!next.delete(id)) next.add(id);
    this.hidden.set(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {}
  }

  create(body: { name: string; color: string; calendarId: string }): Observable<Person> {
    return this.http.post<Person>('/api/people', body).pipe(tap(() => this.load()));
  }

  update(id: number, body: Partial<Pick<Person, 'name' | 'color' | 'sortOrder'>>) {
    return this.http.patch<Person>(`/api/people/${id}`, body).pipe(tap(() => this.load()));
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
