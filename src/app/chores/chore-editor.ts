import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { ChoreInput, ChoresService } from '../core/chores.service';
import { ClockService } from '../core/clock.service';
import { addDays, dayKey, daysBetween, parseDay } from '../core/date';
import { KeyboardService } from '../core/keyboard.service';
import { Chore, Recurrence } from '../core/models';
import { PeopleService } from '../core/people.service';
import { ToastService } from '../core/toast.service';
import { Icon } from '../shared/icon';
import { Osk, OskKey } from '../shared/osk';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MAX_TITLE = 120;
const fmtDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

@Component({
  selector: 'app-chore-editor',
  imports: [Icon, Osk],
  templateUrl: './chore-editor.html',
  styleUrl: './chore-editor.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class ChoreEditor implements OnInit {
  private readonly chores = inject(ChoresService);
  private readonly clock = inject(ClockService);
  private readonly toasts = inject(ToastService);
  protected readonly people = inject(PeopleService);
  protected readonly keyboard = inject(KeyboardService);

  /** Chore to edit; omitted for a new one. */
  readonly chore = input<Chore | null>(null);
  /** Preselected person for a new chore. */
  readonly personId = input<number | null>(null);
  readonly closed = output<void>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly who = signal<number | null>(null);
  protected readonly title = signal('');
  protected readonly kind = signal<Recurrence['kind']>('daily');
  protected readonly days = signal<number[]>([]);
  protected readonly date = signal(this.clock.today());
  protected readonly saving = signal(false);
  protected readonly confirmDelete = signal(false);

  ngOnInit() {
    const c = this.chore();
    if (c) {
      this.who.set(c.personId);
      this.title.set(c.title);
      this.kind.set(c.recurrence.kind);
      if (c.recurrence.kind === 'weekly') this.days.set(c.recurrence.days);
      if (c.recurrence.kind === 'once') this.date.set(c.recurrence.date);
    } else {
      this.who.set(this.personId());
    }
  }

  protected readonly autoCap = computed(() => this.title() === '');

  protected readonly dateLabel = computed(() => {
    const diff = daysBetween(this.clock.today(), this.date());
    const prefix = diff === 0 ? 'Today · ' : diff === 1 ? 'Tomorrow · ' : '';
    return prefix + fmtDate.format(parseDay(this.date()));
  });

  protected readonly recurrence = computed<Recurrence | null>(() => {
    switch (this.kind()) {
      case 'daily':
        return { kind: 'daily' };
      case 'weekly':
        return this.days().length ? { kind: 'weekly', days: [...this.days()].sort() } : null;
      case 'once':
        return { kind: 'once', date: this.date() };
    }
  });

  protected readonly canSave = computed(
    () => this.who() !== null && !!this.title().trim() && !!this.recurrence() && !this.saving(),
  );

  protected onKey(k: OskKey) {
    if (k.type === 'char') this.title.update((t) => (t.length < MAX_TITLE ? t + k.value : t));
    else if (k.type === 'backspace') this.title.update((t) => t.slice(0, -1));
    else this.save();
  }

  protected toggleDay(d: number) {
    this.days.update((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));
  }

  protected shiftDate(n: number) {
    this.date.set(dayKey(addDays(parseDay(this.date()), n)));
  }

  protected save() {
    const who = this.who();
    const recurrence = this.recurrence();
    if (!this.canSave() || who === null || !recurrence) return;

    const body: ChoreInput = { personId: who, title: this.title().trim(), recurrence };
    const existing = this.chore();
    this.saving.set(true);
    (existing ? this.chores.update(existing.id, body) : this.chores.create(body)).subscribe({
      next: () => {
        this.toasts.success(existing ? 'Chore updated' : 'Chore added');
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove() {
    const existing = this.chore();
    if (!existing) return;
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      return;
    }
    this.chores.remove(existing.id).subscribe(() => {
      this.toasts.success('Chore removed');
      this.closed.emit();
    });
  }
}
