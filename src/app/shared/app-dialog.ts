import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { DayKey, describeWhen, parseDay } from '../core/date';
import { DialogService } from '../core/dialog.service';
import { EventsService } from '../core/events.service';
import { CalEvent } from '../core/models';
import { PeopleService } from '../core/people.service';
import { QuickAddService } from '../core/quick-add.service';
import { ToastService } from '../core/toast.service';
import { EventPill } from './event-pill';
import { Icon } from './icon';

const fmtLongDay = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/** The shell's single modal: event details or a day's agenda. */
@Component({
  selector: 'app-dialog',
  imports: [EventPill, Icon],
  templateUrl: './app-dialog.html',
  styleUrl: './app-dialog.scss',
  host: { '(document:keydown.escape)': 'dialogs.close()' },
})
export class AppDialog {
  private readonly http = inject(HttpClient);
  private readonly events = inject(EventsService);
  private readonly people = inject(PeopleService);
  private readonly quickAdd = inject(QuickAddService);
  private readonly toasts = inject(ToastService);
  protected readonly dialogs = inject(DialogService);
  protected readonly describeWhen = describeWhen;

  protected readonly confirmDelete = signal(false);
  protected readonly deleting = signal(false);

  constructor() {
    // Fresh state whenever the dialog opens on something else.
    effect(() => {
      this.dialogs.state();
      this.confirmDelete.set(false);
      this.deleting.set(false);
    });
  }

  protected readonly canEdit = computed(() => {
    const s = this.dialogs.state();
    if (s?.kind !== 'event') return false;
    return this.people.people().find((p) => p.id === s.event.personId)?.canWrite ?? false;
  });

  protected edit(event: CalEvent) {
    this.dialogs.close();
    this.quickAdd.open({ event });
  }

  protected addOn(day: DayKey) {
    this.dialogs.close();
    this.quickAdd.open({ day });
  }

  /** Two taps: the first arms it, the second deletes. */
  protected remove(event: CalEvent) {
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      return;
    }
    this.deleting.set(true);
    const url = `/api/events/${encodeURIComponent(event.calendarId)}/${encodeURIComponent(event.eventId)}`;
    this.http.delete(url).subscribe({
      next: () => {
        this.toasts.success('Event deleted');
        this.events.refresh();
        this.dialogs.close();
      },
      error: () => {
        this.deleting.set(false);
        this.confirmDelete.set(false);
      },
    });
  }

  protected readonly dayTitle = computed(() => {
    const s = this.dialogs.state();
    return s?.kind === 'day' ? fmtLongDay.format(parseDay(s.day)) : '';
  });

  /** Google descriptions are often HTML; show them as plain text. */
  protected readonly descriptionText = computed(() => {
    const s = this.dialogs.state();
    if (s?.kind !== 'event' || !s.event.description) return '';
    const html = s.event.description.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n');
    return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').trim();
  });
}
