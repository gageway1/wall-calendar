import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { DialogService } from './core/dialog.service';
import { QuickAddService } from './core/quick-add.service';
import { QuickAdd } from './quick-add/quick-add';
import { AppDialog } from './shared/app-dialog';
import { Icon, IconName } from './shared/icon';
import { TextPrompt } from './shared/text-prompt';
import { Toasts } from './shared/toasts';

@Component({
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    Icon,
    AppDialog,
    QuickAdd,
    Toasts,
    TextPrompt,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly quickAdd = inject(QuickAddService);
  protected readonly dialogs = inject(DialogService);

  protected readonly nav: { path: string; label: string; icon: IconName }[] = [
    { path: '/', label: 'Home', icon: 'home' },
    { path: '/week', label: 'Week', icon: 'week' },
    { path: '/month', label: 'Month', icon: 'month' },
    { path: '/chores', label: 'Chores', icon: 'chores' },
    { path: '/meals', label: 'Meals', icon: 'meals' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  /** The add-event button floats over the calendar screens. */
  protected readonly showAdd = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => !/^\/(settings|chores|meals)/.test(e.urlAfterRedirects)),
    ),
    { initialValue: false },
  );
}
