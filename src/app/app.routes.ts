import { Routes } from '@angular/router';
import { Chores } from './chores/chores';
import { Home } from './home/home';
import { Meals } from './meals/meals';
import { Month } from './month/month';
import { Settings } from './settings/settings';
import { Week } from './week/week';

export const routes: Routes = [
  { path: '', component: Home, title: 'Wall Calendar' },
  { path: 'week', component: Week, title: 'Week · Wall Calendar' },
  { path: 'month', component: Month, title: 'Month · Wall Calendar' },
  { path: 'chores', component: Chores, title: 'Chores · Wall Calendar' },
  { path: 'meals', component: Meals, title: 'Meals · Wall Calendar' },
  { path: 'settings', component: Settings, title: 'Settings · Wall Calendar' },
  { path: '**', redirectTo: '' },
];
