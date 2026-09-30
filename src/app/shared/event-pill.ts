import { Component, computed, inject, input } from '@angular/core';
import { DayKey, pillTime } from '../core/date';
import { DialogService } from '../core/dialog.service';
import { CalEvent } from '../core/models';

@Component({
  selector: 'app-event-pill',
  template: `
    <button
      type="button"
      class="pill"
      [class.all-day]="event().allDay"
      [class.compact]="compact()"
      [style.--c]="event().color"
      (click)="$event.stopPropagation(); dialogs.openEvent(event())"
    >
      @if (time()) {
        <span class="time">{{ time() }}</span>
      }
      <span class="title">{{ event().title }}</span>
    </button>
  `,
  styleUrl: './event-pill.scss',
})
export class EventPill {
  protected readonly dialogs = inject(DialogService);

  readonly event = input.required<CalEvent>();
  /** The day this pill is drawn on, so multi-day events can say "cont.". */
  readonly day = input.required<DayKey>();
  readonly compact = input(false);

  protected readonly time = computed(() => pillTime(this.event(), this.day()));
}
