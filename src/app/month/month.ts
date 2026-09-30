import { Component, computed, inject, signal } from '@angular/core';
import { ClockService } from '../core/clock.service';
import {
  addDays,
  addMonths,
  dayKey,
  eventsForDay,
  parseDay,
  startOfMonth,
  startOfWeek,
} from '../core/date';
import { DialogService } from '../core/dialog.service';
import { EventsService } from '../core/events.service';
import { EventPill } from '../shared/event-pill';
import { Icon } from '../shared/icon';
import { PersonFilter } from '../shared/person-filter';
import { Swipe } from '../shared/swipe.directive';

const MAX_PILLS = 3;
const fmtTitle = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const fmtDow = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

@Component({
  selector: 'app-month',
  imports: [EventPill, Icon, PersonFilter, Swipe],
  templateUrl: './month.html',
  styleUrl: './month.scss',
})
export class Month {
  private readonly clock = inject(ClockService);
  protected readonly dialogs = inject(DialogService);

  protected readonly offset = signal(0);

  private readonly month = computed(() => addMonths(parseDay(this.clock.today()), this.offset()));
  /** Always 6 rows, so the grid doesn't jump in height between months. */
  private readonly gridStart = computed(() => startOfWeek(startOfMonth(this.month())));

  private readonly events = inject(EventsService).watchRange(() => ({
    from: dayKey(this.gridStart()),
    to: dayKey(addDays(this.gridStart(), 42)),
  }));

  protected readonly title = computed(() => fmtTitle.format(this.month()));

  protected readonly weekdays = computed(() =>
    Array.from({ length: 7 }, (_, i) => fmtDow.format(addDays(this.gridStart(), i))),
  );

  protected readonly cells = computed(() => {
    const today = this.clock.today();
    const events = this.events();
    const month = this.month().getMonth();

    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(this.gridStart(), i);
      const key = dayKey(date);
      const all = eventsForDay(events, key);
      // Overflowing days give up one pill slot so "+N more" always fits.
      const fit = all.length > MAX_PILLS ? MAX_PILLS - 1 : MAX_PILLS;
      return {
        key,
        num: date.getDate(),
        inMonth: date.getMonth() === month,
        isToday: key === today,
        all,
        shown: all.slice(0, fit),
        more: all.length - Math.min(all.length, fit),
      };
    });
  });

  protected shift(n: number) {
    this.offset.update((o) => o + n);
  }
}
