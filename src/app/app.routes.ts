import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Month } from './month/month';
import { Settings } from './settings/settings';
import { Week } from './week/week';

export const routes: Routes = [
  { path: '', component: Home, title: 'Wall Calendar' },
  { path: 'week', component: Week, title: 'Week · Wall Calendar' },
  { path: 'month', component: Month, title: 'Month · Wall Calendar' },
  { path: 'settings', component: Settings, title: 'Settings · Wall Calendar' },
  { path: '**', redirectTo: '' },
];
