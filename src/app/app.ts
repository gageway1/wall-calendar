import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DialogService } from './core/dialog.service';
import { QuickAddService } from './core/quick-add.service';
import { SleepService } from './core/sleep.service';
import { TimerService } from './core/timer.service';
import { WeatherService } from './core/weather.service';
import { QuickAdd } from './quick-add/quick-add';
import { AppDialog } from './shared/app-dialog';
import { Icon, IconName } from './shared/icon';
import { PinPad } from './shared/pin-pad';
import { SleepScreen } from './shared/sleep-screen';
import { TextPrompt } from './shared/text-prompt';
import { Timer } from './shared/timer';
import { Toasts } from './shared/toasts';
import { WifiDialog } from './shared/wifi-dialog';

/** Pixel shift: a 1px nudge every 15 minutes, invisible but kind to an always-on LCD. */
const SHIFTS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const SHIFT_MS = 15 * 60 * 1000;

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
    PinPad,
    SleepScreen,
    Timer,
    WifiDialog,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  host: {
    '[style.transform]': 'shift()',
    '(document:pointerdown)': 'lastPointer = $event.pointerType',
    '(document:contextmenu)': 'blockTouchMenu($event)',
  },
})
export class App implements OnDestroy {
  protected readonly quickAdd = inject(QuickAddService);
  protected readonly sleep = inject(SleepService);
  protected readonly timer = inject(TimerService);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);
  // Start weather at boot so the night screen has it even if Home was never opened.
  private readonly weather = inject(WeatherService);

  protected readonly wifiOpen = signal(false);

  /** Most recent input type; long-press menus only come from touch or pen. */
  protected lastPointer = 'mouse';

  /**
   * No long-press menu on the wall (Chrome ignores -webkit-touch-callout). A real mouse
   * right-click still works, so Inspect stays available while developing.
   */
  protected blockTouchMenu(e: MouseEvent) {
    const type = (e as PointerEvent).pointerType || this.lastPointer;
    if (type !== 'mouse') e.preventDefault();
  }

  protected readonly nav: { path: string; label: string; icon: IconName }[] = [
    { path: '/', label: 'Home', icon: 'home' },
    { path: '/week', label: 'Week', icon: 'week' },
    { path: '/month', label: 'Month', icon: 'month' },
    { path: '/chores', label: 'Chores', icon: 'chores' },
    { path: '/meals', label: 'Meals', icon: 'meals' },
    { path: '/lists', label: 'Lists', icon: 'lists' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  private shiftIndex = 0;
  protected readonly shift = signal('none');
  private readonly shiftTimer = setInterval(() => {
    const [x, y] = SHIFTS[++this.shiftIndex % SHIFTS.length];
    this.shift.set(x || y ? `translate(${x}px, ${y}px)` : 'none');
  }, SHIFT_MS);

  constructor() {
    // Going to sleep: tidy up so the wall wakes to Home, not a half-open form.
    effect(() => {
      if (!this.sleep.asleep()) return;
      this.quickAdd.close();
      this.dialogs.close();
      this.wifiOpen.set(false);
      void this.router.navigateByUrl('/');
    });
  }

  ngOnDestroy() {
    clearInterval(this.shiftTimer);
  }
}
