import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { ClockService } from '../core/clock.service';
import {
  addDays,
  atMinutes,
  dayKey,
  daysBetween,
  formatDuration,
  formatMinutes,
  parseDay,
} from '../core/date';
import { EventsService } from '../core/events.service';
import { KeyboardService } from '../core/keyboard.service';
import { CalEvent, TitleSuggestion } from '../core/models';
import { PeopleService } from '../core/people.service';
import { QuickAddRequest, QuickAddService } from '../core/quick-add.service';
import { Icon } from '../shared/icon';
import { Osk, OskKey } from '../shared/osk';

const DEFAULT_START = 12 * 60;
const DEFAULT_LENGTH = 60;
const MAX_START = 24 * 60 - 15;
const MAX_LENGTH = 24 * 60;
const MAX_DAYS = 30;
const MAX_SUGGESTIONS = 8;

const fmtDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

@Component({
  selector: 'app-quick-add',
  imports: [Icon, Osk],
  templateUrl: './quick-add.html',
  styleUrl: './quick-add.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class QuickAdd implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly clock = inject(ClockService);
  private readonly events = inject(EventsService);
  private readonly quickAdd = inject(QuickAddService);
  protected readonly people = inject(PeopleService);
  protected readonly keyboard = inject(KeyboardService);

  readonly request = input.required<QuickAddRequest>();

  protected readonly editing = signal<CalEvent | null>(null);
  protected readonly personId = signal<number | null>(null);
  protected readonly title = signal('');
  protected readonly date = signal(this.clock.today());
  protected readonly allDay = signal(false);
  /** Timed: start as minutes since midnight. */
  protected readonly startMin = signal(DEFAULT_START);
  /** Timed: length in minutes. */
  protected readonly lengthMin = signal(DEFAULT_LENGTH);
  /** All-day: number of days. */
  protected readonly days = signal(1);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly suggestions = signal<TitleSuggestion[]>([]);

  protected readonly formatMinutes = formatMinutes;
  protected readonly formatDuration = formatDuration;

  ngOnInit() {
    const { day, event } = this.request();
    if (event) {
      this.editing.set(event);
      this.personId.set(event.personId);
      this.title.set(event.title);
      this.allDay.set(event.allDay);
      if (event.allDay) {
        this.date.set(event.start);
        this.days.set(Math.max(1, daysBetween(event.start, event.end)));
      } else {
        const s = new Date(event.start);
        this.date.set(dayKey(s));
        this.startMin.set(s.getHours() * 60 + s.getMinutes());
        this.lengthMin.set(
          Math.max(15, Math.round((Date.parse(event.end) - s.getTime()) / 60_000)),
        );
      }
    } else if (day) {
      this.date.set(day);
    }

    this.http
      .get<TitleSuggestion[]>('/api/events/suggestions')
      .subscribe((s) => this.suggestions.set(s));
  }

  protected readonly writablePeople = computed(() =>
    this.people.people().filter((p) => p.canWrite),
  );

  protected readonly dateLabel = computed(() => {
    const diff = daysBetween(this.clock.today(), this.date());
    const prefix = diff === 0 ? 'Today · ' : diff === 1 ? 'Tomorrow · ' : '';
    return prefix + fmtDate.format(parseDay(this.date()));
  });

  protected readonly rangeLabel = computed(() => {
    if (this.allDay()) {
      const last = addDays(parseDay(this.date()), this.days() - 1);
      return this.days() === 1 ? 'All day' : `Through ${fmtDate.format(last)}`;
    }
    const endTotal = this.startMin() + this.lengthMin();
    const extraDays = Math.floor(endTotal / (24 * 60));
    const suffix = extraDays === 1 ? ' (next day)' : extraDays > 1 ? ` (+${extraDays} days)` : '';
    return `${formatMinutes(this.startMin())} – ${formatMinutes(endTotal % (24 * 60))}${suffix}`;
  });

  /** Sentence-start capitalization for the built-in keyboard. */
  protected readonly autoCap = computed(() => {
    const t = this.title();
    return t === '' || /[.!?]\s$/.test(t);
  });

  /** Recent titles matching what's typed; the selected person's own titles first. */
  protected readonly titleSuggestions = computed(() => {
    const q = this.title().trim().toLowerCase();
    const person = this.personId();
    const seen = new Set<string>();
    return [...this.suggestions()]
      .sort(
        (a, b) =>
          Number(b.personId === person) - Number(a.personId === person) || b.count - a.count,
      )
      .filter((s) => {
        const key = s.title.toLowerCase();
        if (seen.has(key) || key === q || (q && !key.includes(q))) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_SUGGESTIONS)
      .map((s) => s.title);
  });

  protected readonly canSave = computed(
    () => this.personId() !== null && this.title().trim().length > 0 && !this.saving(),
  );

  protected onKey(k: OskKey) {
    if (k.type === 'char') this.title.update((t) => t + k.value);
    else if (k.type === 'backspace') this.title.update((t) => t.slice(0, -1));
    else if (this.canSave()) this.save();
  }

  protected shiftDate(n: number) {
    this.date.set(dayKey(addDays(parseDay(this.date()), n)));
  }

  protected shiftStart(n: number) {
    this.startMin.update((v) => clamp(v + n, 0, MAX_START));
  }

  protected shiftLength(n: number) {
    this.lengthMin.update((v) => clamp(v + n, 15, MAX_LENGTH));
  }

  protected shiftDays(n: number) {
    this.days.update((v) => clamp(v + n, 1, MAX_DAYS));
  }

  protected save() {
    const personId = this.personId();
    if (personId === null || !this.canSave()) return;

    const body = this.allDay()
      ? {
          personId,
          title: this.title().trim(),
          allDay: true,
          start: this.date(),
          end: dayKey(addDays(parseDay(this.date()), this.days())),
        }
      : {
          personId,
          title: this.title().trim(),
          allDay: false,
          start: atMinutes(this.date(), this.startMin()).toISOString(),
          end: atMinutes(this.date(), this.startMin() + this.lengthMin()).toISOString(),
        };

    const ev = this.editing();
    const req = ev
      ? this.http.patch(
          `/api/events/${encodeURIComponent(ev.calendarId)}/${encodeURIComponent(ev.eventId)}`,
          body,
        )
      : this.http.post('/api/events', body);

    this.saving.set(true);
    this.error.set(null);
    req.subscribe({
      next: () => {
        this.events.refresh();
        this.close();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(err.error?.error ?? err.error?.message ?? "Couldn't save. Try again.");
      },
    });
  }

  protected close() {
    this.quickAdd.close();
  }
}
