import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ClockService } from '../core/clock.service';
import { addDays, dayKey, eventsForDay, formatTime, parseDay } from '../core/date';
import { DialogService } from '../core/dialog.service';
import { EventsService } from '../core/events.service';
import { CalEvent } from '../core/models';
import { PeopleService } from '../core/people.service';
import { WeatherService, describeWeather } from '../core/weather.service';
import { EventPill } from '../shared/event-pill';

const WEEK_PILLS = 3;
const fmtDow = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

@Component({
  selector: 'app-home',
  imports: [DatePipe, EventPill],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly clock = inject(ClockService);
  protected readonly weather = inject(WeatherService);
  protected readonly dialogs = inject(DialogService);
  protected readonly people = inject(PeopleService);
  protected readonly describe = describeWeather;

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
