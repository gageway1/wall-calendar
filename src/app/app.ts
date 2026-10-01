import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { DialogService } from './core/dialog.service';
import { QuickAddService } from './core/quick-add.service';
import { QuickAdd } from './quick-add/quick-add';
import { AppDialog } from './shared/app-dialog';
import { Icon, IconName } from './shared/icon';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, AppDialog, QuickAdd],
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
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  /** The add button floats over every screen except Settings. */
  protected readonly showAdd = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => !e.urlAfterRedirects.startsWith('/settings')),
    ),
    { initialValue: false },
  );
}
