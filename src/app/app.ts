import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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

  protected readonly nav: { path: string; label: string; icon: IconName }[] = [
    { path: '/', label: 'Home', icon: 'home' },
    { path: '/week', label: 'Week', icon: 'week' },
    { path: '/month', label: 'Month', icon: 'month' },
    { path: '/chores', label: 'Chores', icon: 'chores' },
    { path: '/meals', label: 'Meals', icon: 'meals' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];
}
