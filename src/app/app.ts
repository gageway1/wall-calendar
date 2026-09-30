import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppDialog } from './shared/app-dialog';
import { Icon, IconName } from './shared/icon';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, AppDialog],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly nav: { path: string; label: string; icon: IconName }[] = [
    { path: '/', label: 'Home', icon: 'home' },
    { path: '/week', label: 'Week', icon: 'week' },
    { path: '/month', label: 'Month', icon: 'month' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];
}
