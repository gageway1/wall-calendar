import { Component, computed, inject, signal } from '@angular/core';
import { ChoresService, describeRecurrence } from '../core/chores.service';
import { Chore } from '../core/models';
import { PeopleService } from '../core/people.service';
import { PinService } from '../core/pin.service';
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
  private readonly pin = inject(PinService);
  protected readonly describe = describeRecurrence;

  /** Open editor: `chore` to edit, or just `personId` for a new one. */
  protected readonly editing = signal<{
    chore: Chore | null;
    personId: number | null;
    unlocked: boolean;
  } | null>(null);

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

  /** Kids' chore lists ask for the parent PIN before anything can be changed. */
  protected async open(chore: Chore | null, personId: number) {
    const person = this.people.people().find((p) => p.id === personId);
    let unlocked = false;
    if (person?.choresLocked) {
      if (!(await this.pin.require(`PIN to change ${person.name}'s chores`))) return;
      unlocked = true;
    }
    this.editing.set({ chore, personId: chore ? null : personId, unlocked });
  }
}
