import { Component, computed, inject, signal } from '@angular/core';
import { ChoresService, describeRecurrence } from '../core/chores.service';
import { Chore } from '../core/models';
import { PeopleService } from '../core/people.service';
import { ChoreEditor } from './chore-editor';

/** Manage chores: one column per person. */
@Component({
  selector: 'app-chores',
  imports: [ChoreEditor],
  templateUrl: './chores.html',
  styleUrl: './chores.scss',
})
export class Chores {
  protected readonly chores = inject(ChoresService);
  protected readonly people = inject(PeopleService);
  protected readonly describe = describeRecurrence;

  /** Open editor: `chore` to edit, or just `personId` for a new one. */
  protected readonly editing = signal<{ chore: Chore | null; personId: number | null } | null>(
    null,
  );

  protected readonly columns = computed(() => {
    const today = this.chores.today();
    const todayById = new Map(today?.items.map((i) => [i.id, i]) ?? []);
    return this.people.withChores().map((p) => ({
      person: p,
      streak: today?.streaks[p.id] ?? 0,
      chores: this.chores
        .all()
        .filter((c) => c.personId === p.id)
        .map((c) => ({ chore: c, today: todayById.get(c.id) })),
    }));
  });

  constructor() {
    this.chores.refresh();
  }
}
