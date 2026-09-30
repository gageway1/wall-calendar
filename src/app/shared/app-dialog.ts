import { Component, computed, inject } from '@angular/core';
import { describeWhen, parseDay } from '../core/date';
import { DialogService } from '../core/dialog.service';
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
  protected readonly dialogs = inject(DialogService);
  protected readonly describeWhen = describeWhen;

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
