import { Injectable, signal } from '@angular/core';
import { DayKey } from './date';
import { CalEvent } from './models';

export type DialogState =
  { kind: 'event'; event: CalEvent } | { kind: 'day'; day: DayKey; events: CalEvent[] };

/** Single app-wide modal, rendered by the shell. */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly state = signal<DialogState | null>(null);

  openEvent(event: CalEvent) {
    this.state.set({ kind: 'event', event });
  }

  openDay(day: DayKey, events: CalEvent[]) {
    this.state.set({ kind: 'day', day, events });
  }

  close() {
    this.state.set(null);
  }
}
