import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChoresService } from '../core/chores.service';
import { LunchService, entrees } from '../core/lunch.service';
import { ClockService } from '../core/clock.service';
import { addDays, dayKey, eventsForDay, formatTime, parseDay } from '../core/date';
import { DialogService } from '../core/dialog.service';
import { EventsService } from '../core/events.service';
import { CalEvent, ChoreItem, Meal } from '../core/models';
import { PeopleService } from '../core/people.service';
import { WeatherService, describeWeather } from '../core/weather.service';
import { EventPill } from '../shared/event-pill';
import { RouterLink } from '@angular/router';

const WEEK_PILLS = 3;
const fmtDow = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const fmtDowLong = new Intl.DateTimeFormat(undefined, { weekday: 'long' });

@Component({
  selector: 'app-home',
  imports: [DatePipe, EventPill, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly clock = inject(ClockService);
  protected readonly weather = inject(WeatherService);
  protected readonly dialogs = inject(DialogService);
  protected readonly people = inject(PeopleService);
  protected readonly describe = describeWeather;
  protected readonly chores = inject(ChoresService);
  private readonly http = inject(HttpClient);

  protected readonly dinner = signal<string | null>(null);
  protected readonly lunchSvc = inject(LunchService);

  private readonly lunches = this.lunchSvc.watchRange(() => {
    const today = parseDay(this.clock.today());
    return { from: dayKey(today), to: dayKey(addDays(today, 8)) };
  });

  /**
   * The lunch worth knowing about: today's until 2pm (it's been eaten after that), then the next
   * school day's, so the evening shows tomorrow's for packing-lunch decisions.
   */
  protected readonly lunchLine = computed(() => {
    const now = this.clock.now();
    const today = this.clock.today();
    const from = now.getHours() >= 14 ? dayKey(addDays(parseDay(today), 1)) : today;
    const next = this.lunches().find((l) => l.day >= from);
    if (!next) return null;
    const diff = Math.round(
      (parseDay(next.day).getTime() - parseDay(today).getTime()) / 86_400_000,
    );
    const when =
      diff === 0 ? '' : diff === 1 ? 'Tomorrow · ' : `${fmtDowLong.format(parseDay(next.day))} · `;
    return {
      label: this.lunchSvc.label(),
      text: next.noSchool ? `No school (${next.noSchool})` : entrees(next),
      when,
    };
  });

  constructor() {
    // Tonight's dinner, refreshed when the date flips.
    effect((onCleanup) => {
      const today = this.clock.today();
      const sub = this.http
        .get<Meal[]>('/api/meals', {
          params: { from: today, to: dayKey(addDays(parseDay(today), 1)) },
        })
        .subscribe({ next: (m) => this.dinner.set(m[0]?.title ?? null), error: () => {} });
      onCleanup(() => sub.unsubscribe());
    });
  }

  /** Today's chores grouped by person, in people order; done ones sink to the bottom. */
  protected readonly choreGroups = computed(() => {
    const day = this.chores.today();
    if (!day) return [];
    return this.people
      .withChores()
      .map((p) => ({
        person: p,
        streak: day.streaks[p.id] ?? 0,
        items: day.items
          .filter((i) => i.personId === p.id)
          .sort((a, b) => Number(a.done) - Number(b.done)),
      }))
      .filter((g) => g.items.length);
  });

  protected readonly choresLeft = computed(
    () => this.chores.today()?.items.filter((i) => !i.done).length ?? 0,
  );

  protected toggle(item: ChoreItem) {
    this.chores.toggle(item);
  }

  private readonly events = inject(EventsService).watchRange(() => {
    const today = parseDay(this.clock.today());
    return { from: dayKey(today), to: dayKey(addDays(today, 7)) };
  });

  protected readonly current = computed(() => {
    const s = this.weather.state();
    return s.status === 'ok' ? s.data : undefined;
  });

  protected readonly agenda = computed(() => {
    const today = this.clock.today();
    const now = this.clock.now().getTime();
    return eventsForDay(this.events(), today).map((e) => ({
      event: e,
      time: e.allDay ? 'All day' : this.agendaTime(e, today),
      done: !e.allDay && new Date(e.end).getTime() < now,
    }));
  });

  /** The next 7 days: forecast + a few events each. */
  protected readonly week = computed(() => {
    const events = this.events();
    const forecast = this.current()?.daily ?? [];
    const start = parseDay(this.clock.today());

    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const key = dayKey(date);
      const all = eventsForDay(events, key);
      return {
        key,
        label: i === 0 ? 'Today' : fmtDow.format(date),
        forecast: forecast.find((f) => f.date === key),
        all,
        shown: all.slice(0, WEEK_PILLS),
        more: Math.max(0, all.length - WEEK_PILLS),
      };
    });
  });

  private agendaTime(e: CalEvent, today: string) {
    const startsToday = dayKey(new Date(e.start)) === today;
    return startsToday ? formatTime(e.start) : `until ${formatTime(e.end)}`;
  }
}
