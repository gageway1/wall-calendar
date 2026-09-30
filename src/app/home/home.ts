import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ClockService } from '../core/clock.service';
import { WeatherService, describeWeather } from '../core/weather.service';

@Component({
  selector: 'app-home',
  imports: [DatePipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly clock = inject(ClockService);
  protected readonly weather = inject(WeatherService);
  protected readonly describe = describeWeather;

  protected readonly current = computed(() => {
    const s = this.weather.state();
    return s.status === 'ok' ? s.data : undefined;
  });

  /** Local-midnight Date for a YYYY-MM-DD string (avoids UTC off-by-one in the date pipe). */
  protected day(date: string) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}
