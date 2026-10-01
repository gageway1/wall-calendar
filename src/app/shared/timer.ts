import { Component, computed, inject } from '@angular/core';
import { TimerService } from '../core/timer.service';
import { Icon } from './icon';

const RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Timer panel (pick a time / watch the ring) and the full-screen "Time's up!". */
@Component({
  selector: 'app-timer',
  imports: [Icon],
  templateUrl: './timer.html',
  styleUrl: './timer.scss',
})
export class Timer {
  protected readonly timer = inject(TimerService);
  protected readonly presets = [1, 2, 3, 5, 10, 15, 20, 30, 60];
  protected readonly radius = RADIUS;
  protected readonly circumference = CIRCUMFERENCE;

  /** Ring drains clockwise as time runs out. */
  protected readonly dashOffset = computed(() => CIRCUMFERENCE * (1 - this.timer.fraction()));

  /** Green, then amber in the last minute, red in the last 10 seconds. */
  protected readonly color = computed(() => {
    const ms = this.timer.remainingMs();
    return ms <= 10_000 ? '#ff6b6b' : ms <= 60_000 ? '#fcc419' : '#51cf66';
  });

  protected start(min: number) {
    this.timer.start(min);
  }
}
