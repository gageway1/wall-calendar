import { Component, computed, inject, signal } from '@angular/core';
import { ClockService } from '../core/clock.service';
import { addDays, dayKey, eventsForDay, parseDay, startOfWeek } from '../core/date';
import { EventsService } from '../core/events.service';
import { WeatherService, describeWeather } from '../core/weather.service';
import { EventPill } from '../shared/event-pill';
import { Icon } from '../shared/icon';
import { PersonFilter } from '../shared/person-filter';
import { Swipe } from '../shared/swipe.directive';

const fmtRangeStart = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' });
const fmtRangeEnd = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const fmtDow = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

@Component({
  selector: 'app-week',
  imports: [EventPill, Icon, PersonFilter, Swipe],
  templateUrl: './week.html',
  styleUrl: './week.scss',
})
export class Week {
  private readonly clock = inject(ClockService);
  private readonly weather = inject(WeatherService);

  /** Offset in weeks from the current week. */
  protected readonly offset = signal(0);

  private readonly start = computed(() =>
    addDays(startOfWeek(parseDay(this.clock.today())), this.offset() * 7),
  );

  private readonly events = inject(EventsService).watchRange(() => ({
    from: dayKey(this.start()),
    to: dayKey(addDays(this.start(), 7)),
  }));

  protected readonly title = computed(() => {
    const s = this.start();
    return `${fmtRangeStart.format(s)} – ${fmtRangeEnd.format(addDays(s, 6))}`;
  });

  protected readonly days = computed(() => {
    const today = this.clock.today();
    const events = this.events();
    const w = this.weather.state();
    const forecast = w.status === 'ok' ? w.data.daily : [];

    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(this.start(), i);
      const key = dayKey(date);
      const f = forecast.find((d) => d.date === key);
      return {
        key,
        dow: fmtDow.format(date),
        num: date.getDate(),
        isToday: key === today,
        isPast: key < today,
        weather: f && { icon: describeWeather(f.code).icon, high: f.high },
        events: eventsForDay(events, key),
      };
    });
  });

  protected shift(n: number) {
    this.offset.update((o) => o + n);
  }
}
