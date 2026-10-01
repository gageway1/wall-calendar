import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ClockService } from '../core/clock.service';
import { addDays, dayKey, formatTime, parseDay } from '../core/date';
import { EventsService } from '../core/events.service';
import { SleepService } from '../core/sleep.service';
import { WeatherService, describeWeather } from '../core/weather.service';

const DRIFT_MS = 60 * 1000;
const MAX_EVENTS = 3;

/**
 * The night screen: dim clock plus a few tiny details, drifting to a new spot every minute so no
 * pixel shows the same thing all night. Any tap wakes the wall.
 */
@Component({
  selector: 'app-sleep-screen',
  imports: [DatePipe],
  templateUrl: './sleep-screen.html',
  styleUrl: './sleep-screen.scss',
})
export class SleepScreen implements OnDestroy {
  protected readonly sleep = inject(SleepService);
  protected readonly clock = inject(ClockService);
  private readonly weather = inject(WeatherService);
  private readonly block = viewChild<ElementRef<HTMLElement>>('block');

  protected readonly offset = signal({ x: 0, y: 0 });
  private readonly drift = setInterval(() => this.move(), DRIFT_MS);

  private readonly events = inject(EventsService).watchRange(() => {
    const today = parseDay(this.clock.today());
    return { from: dayKey(today), to: dayKey(addDays(today, 2)) };
  });

  /** The next few things still ahead (rest of today, then tomorrow). */
  protected readonly upcoming = computed(() => {
    const now = this.clock.now().getTime();
    const today = this.clock.today();
    return this.events()
      .filter((e) => (e.allDay ? e.end > today : Date.parse(e.end) > now))
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start))
      .slice(0, MAX_EVENTS)
      .map((e) => {
        const day = e.allDay ? e.start : dayKey(new Date(e.start));
        const when = e.allDay ? 'All day' : formatTime(e.start);
        return {
          id: e.id,
          title: e.title,
          color: e.color,
          when: day > today ? `Tmrw ${when}` : when,
        };
      });
  });

  protected readonly temp = computed(() => {
    const s = this.weather.state();
    return s.status === 'ok'
      ? {
          t: s.data.current.temp,
          icon: describeWeather(s.data.current.code, s.data.current.isDay).icon,
        }
      : null;
  });

  private move() {
    const el = this.block()?.nativeElement;
    if (!el) return;
    const maxX = Math.max(0, window.innerWidth - el.offsetWidth - 80);
    const maxY = Math.max(0, window.innerHeight - el.offsetHeight - 80);
    this.offset.set({ x: Math.random() * maxX - maxX / 2, y: Math.random() * maxY - maxY / 2 });
  }

  ngOnDestroy() {
    clearInterval(this.drift);
  }
}
