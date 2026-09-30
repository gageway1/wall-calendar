import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';

export interface Weather {
  location: string;
  current: { temp: number; code: number; isDay: boolean };
  daily: { date: string; high: number; low: number; code: number; precipChance: number }[];
  units: 'fahrenheit' | 'celsius';
  fetchedAt: string;
}

export type WeatherState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'error' }
  | { status: 'ok'; data: Weather };

const REFRESH_MS = 10 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class WeatherService implements OnDestroy {
  private readonly http = inject(HttpClient);
  readonly state = signal<WeatherState>({ status: 'loading' });

  private readonly timer = setInterval(() => this.refresh(), REFRESH_MS);

  constructor() {
    this.refresh();
  }

  refresh() {
    this.http.get<Weather>('/api/weather').subscribe({
      next: (data) => this.state.set({ status: 'ok', data }),
      error: (err: HttpErrorResponse) => {
        // Keep showing the last good reading through transient failures.
        if (this.state().status === 'ok') return;
        this.state.set({ status: err.status === 404 ? 'unconfigured' : 'error' });
      },
    });
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}

/** WMO weather interpretation codes → label + emoji. */
export function describeWeather(code: number, isDay = true): { label: string; icon: string } {
  if (code === 0) return { label: 'Clear', icon: isDay ? '☀️' : '🌙' };
  if (code <= 2) return { label: 'Partly cloudy', icon: isDay ? '⛅' : '☁️' };
  if (code === 3) return { label: 'Cloudy', icon: '☁️' };
  if (code <= 48) return { label: 'Fog', icon: '🌫️' };
  if (code <= 57) return { label: 'Drizzle', icon: '🌦️' };
  if (code <= 67) return { label: 'Rain', icon: '🌧️' };
  if (code <= 77) return { label: 'Snow', icon: '🌨️' };
  if (code <= 82) return { label: 'Showers', icon: '🌦️' };
  if (code <= 86) return { label: 'Snow showers', icon: '🌨️' };
  return { label: 'Thunderstorms', icon: '⛈️' };
}
