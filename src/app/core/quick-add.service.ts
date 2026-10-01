import { Injectable, signal } from '@angular/core';
import { DayKey } from './date';
import { CalEvent } from './models';

/** Open the event form: `event` to edit, otherwise a new event (optionally on `day`). */
export interface QuickAddRequest {
  day?: DayKey;
  event?: CalEvent;
}

@Injectable({ providedIn: 'root' })
export class QuickAddService {
  readonly request = signal<QuickAddRequest | null>(null);

  open(request: QuickAddRequest = {}) {
    this.request.set(request);
  }

  close() {
    this.request.set(null);
  }
}
