import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EventsService } from '../core/events.service';
import { reportError } from '../core/error-reporting';
import { KeyboardService } from '../core/keyboard.service';
import { GoogleCalendar, GoogleStatus, PERSON_COLORS, Person } from '../core/models';
import { PeopleService } from '../core/people.service';
import { GENERIC_ERROR, ToastService } from '../core/toast.service';

interface LogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly http = inject(HttpClient);
  private readonly events = inject(EventsService);
  protected readonly peopleSvc = inject(PeopleService);
  protected readonly colors = PERSON_COLORS;
  protected readonly keyboard = inject(KeyboardService);
  protected readonly toasts = inject(ToastService);

  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);
  protected readonly callbackError = computed(() => !!this.query()?.get('google_error'));
  protected readonly justConnected = computed(() => this.query()?.get('google') === 'connected');

  protected readonly status = signal<GoogleStatus | null>(null);
  protected readonly calendars = signal<GoogleCalendar[]>([]);
  protected readonly syncing = signal(false);
  /** Google sign-in only works through http://localhost (see README). */
  protected readonly onLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);

  /** Every Google calendar, paired with the person it's mapped to (if any). */
  protected readonly rows = computed(() => {
    const byCalendar = new Map(this.peopleSvc.people().map((p) => [p.calendarId, p]));
    return this.calendars().map((cal) => ({ cal, person: byCalendar.get(cal.id) }));
  });

  constructor() {
    this.loadStatus();
  }

  private loadStatus() {
    this.http.get<GoogleStatus>('/api/google/status').subscribe({
      next: (s) => {
        this.status.set(s);
        if (s.connected) this.loadCalendars();
      },
      error: () => {}, // Interceptor already warned.
    });
  }

  private loadCalendars() {
    this.http
      .get<GoogleCalendar[]>('/api/google/calendars')
      .subscribe({ next: (c) => this.calendars.set(c), error: () => {} });
  }

  protected syncNow() {
    this.syncing.set(true);
    this.http.post('/api/google/sync', {}).subscribe({
      next: () => {
        this.toasts.success('Calendars synced');
        this.events.refresh();
        this.loadStatus();
      },
      complete: () => this.syncing.set(false),
      error: () => this.syncing.set(false),
    });
  }

  protected disconnect() {
    if (!confirm('Disconnect Google? The wall stops syncing until you reconnect.')) return;
    this.http.post('/api/google/disconnect', {}).subscribe(() => {
      this.toasts.success('Google disconnected');
      this.calendars.set([]);
      this.loadStatus();
    });
  }

  protected addPerson(cal: GoogleCalendar) {
    const used = new Set(this.peopleSvc.people().map((p) => p.color));
    const color = this.colors.find((c) => !used.has(c)) ?? this.colors[0];
    this.peopleSvc
      .create({ name: cal.name, color, calendarId: cal.id, accessRole: cal.accessRole })
      // Initial sync runs server-side; give it a moment before refetching events.
      .subscribe(() => {
        this.toasts.success(`${cal.name} added to the wall`);
        setTimeout(() => this.events.refresh(), 3000);
      });
  }

  protected rename(p: Person, name: string) {
    if (name.trim() && name.trim() !== p.name) {
      this.peopleSvc.update(p.id, { name }).subscribe(() => {
        this.toasts.success('Name saved');
        this.events.refresh();
      });
    }
  }

  protected recolor(p: Person, color: string) {
    this.peopleSvc.update(p.id, { color }).subscribe(() => {
      this.toasts.success('Color saved');
      this.events.refresh();
    });
  }

  protected remove(p: Person) {
    if (!confirm(`Remove ${p.name} from the wall? (Their Google calendar is not touched.)`)) return;
    this.peopleSvc.remove(p.id).subscribe(() => {
      this.toasts.success(`${p.name} removed from the wall`);
      this.events.refresh();
    });
  }

  // --- Diagnostics -------------------------------------------------------

  protected readonly logs = signal<{ file: string; entries: LogEntry[] } | null>(null);

  protected testSuccess() {
    this.toasts.success('Test: saved successfully');
  }

  protected testWarn() {
    this.toasts.warn('Test: this is a warning');
  }

  protected testError() {
    this.toasts.error(GENERIC_ERROR);
  }

  /** The same error 50 times: should collapse into one toast with a count. */
  protected testErrorRepeat() {
    for (let i = 0; i < 50; i++) this.toasts.error(GENERIC_ERROR);
  }

  /** 40 different errors: should fill the screen, then queue the rest as "+N more". */
  protected testErrorFlood() {
    for (let i = 1; i <= 40; i++) this.toasts.error(`Test error #${i}`);
  }

  protected testLog() {
    reportError(`Test error from Settings at ${new Date().toLocaleTimeString()}`, {
      note: 'Fake error to verify logging',
    });
    this.toasts.success('Test error sent to the log');
    setTimeout(() => this.loadLogs(), 500);
  }

  protected loadLogs() {
    this.http
      .get<{ file: string; entries: LogEntry[] }>('/api/logs/recent?limit=15')
      .subscribe((l) => this.logs.set(l));
  }

  protected formatTime(iso: string | null) {
    return iso ? new Date(iso).toLocaleString() : 'never';
  }
}
