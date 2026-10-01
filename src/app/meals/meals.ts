import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ClockService } from '../core/clock.service';
import { addDays, dayKey, parseDay, startOfWeek } from '../core/date';
import { LunchDay, LunchService, entrees } from '../core/lunch.service';
import { Meal } from '../core/models';
import { TextPromptService } from '../core/text-prompt.service';
import { ToastService } from '../core/toast.service';
import { Icon } from '../shared/icon';
import { Swipe } from '../shared/swipe.directive';

const fmtRangeStart = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' });
const fmtRangeEnd = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const fmtDow = new Intl.DateTimeFormat(undefined, { weekday: 'long' });

/** A week of dinners. Tap a day to plan it. */
@Component({
  selector: 'app-meals',
  imports: [Icon, Swipe],
  templateUrl: './meals.html',
  styleUrl: './meals.scss',
})
export class Meals {
  private readonly http = inject(HttpClient);
  private readonly clock = inject(ClockService);
  private readonly prompt = inject(TextPromptService);
  private readonly toasts = inject(ToastService);
  protected readonly lunchSvc = inject(LunchService);
  protected readonly entrees = entrees;
  /** Day whose full school menu is open. */
  protected readonly menuOpen = signal<{ dow: string; lunch: LunchDay } | null>(null);

  protected readonly offset = signal(0);
  private readonly meals = signal<Meal[]>([]);
  private readonly version = signal(0);

  private readonly start = computed(() =>
    addDays(startOfWeek(parseDay(this.clock.today())), this.offset() * 7),
  );

  private readonly lunches = this.lunchSvc.watchRange(() => ({
    from: dayKey(this.start()),
    to: dayKey(addDays(this.start(), 7)),
  }));

  constructor() {
    effect((onCleanup) => {
      this.version();
      const from = dayKey(this.start());
      const sub = this.http
        .get<Meal[]>('/api/meals', { params: { from, to: dayKey(addDays(this.start(), 7)) } })
        .subscribe({ next: (m) => this.meals.set(m), error: () => {} });
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected readonly title = computed(
    () => `${fmtRangeStart.format(this.start())} – ${fmtRangeEnd.format(addDays(this.start(), 6))}`,
  );

  protected readonly days = computed(() => {
    const today = this.clock.today();
    const byDay = new Map(this.meals().map((m) => [m.day, m.title]));
    const lunchByDay = new Map(this.lunches().map((l) => [l.day, l]));
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(this.start(), i);
      const key = dayKey(date);
      return {
        key,
        dow: key === today ? 'Today' : fmtDow.format(date),
        num: date.getDate(),
        isToday: key === today,
        isPast: key < today,
        dinner: byDay.get(key) ?? null,
        lunch: lunchByDay.get(key) ?? null,
      };
    });
  });

  protected async plan(day: { key: string; dow: string; dinner: string | null }) {
    const suggestions = await new Promise<string[]>((resolve) =>
      this.http.get<string[]>('/api/meals/suggestions').subscribe({
        next: resolve,
        error: () => resolve([]),
      }),
    );
    const title = await this.prompt.ask({
      title: `Dinner · ${day.dow}`,
      value: day.dinner ?? '',
      placeholder: "What's for dinner?",
      suggestions,
      allowClear: !!day.dinner,
    });
    if (title === null) return;

    this.http.put(`/api/meals/${day.key}`, { title }).subscribe(() => {
      this.toasts.success(title ? 'Dinner saved' : 'Dinner cleared');
      this.version.update((v) => v + 1);
    });
  }

  protected shift(n: number) {
    this.offset.update((o) => o + n);
  }
}
