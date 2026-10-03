import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Injectable,
  OnDestroy,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ClockService } from './clock.service';

export interface Theme {
  id: string;
  name: string;
  scheme: 'dark' | 'light';
  /** CSS custom properties layered over the defaults in styles.scss. */
  tokens: Record<string, string>;
  /** MM-DD, inclusive; may wrap past New Year. */
  season: { start: string; end: string } | null;
}

export interface ThemePref {
  /** 'auto' = seasonal themes on their dates, else `everyday`. Otherwise a pinned theme id. */
  selected: string;
  everyday: string;
}

interface ThemeResponse extends ThemePref {
  themes: Theme[];
}

const CACHE_KEY = 'wall.theme';
const RELOAD_MS = 10 * 60 * 1000;
/** How long the first render waits for the server's theme before using the cached one. */
const FIRST_LOAD_WAIT_MS = 1500;

export function inSeason(mmdd: string, season: { start: string; end: string }): boolean {
  const { start, end } = season;
  return start <= end ? mmdd >= start && mmdd <= end : mmdd >= start || mmdd <= end;
}

/** The theme Automatic would show on `day` (YYYY-MM-DD). */
export function autoTheme(themes: Theme[], everyday: string, day: string): Theme | undefined {
  const mmdd = day.slice(5);
  return (
    themes.find((t) => t.season && inSeason(mmdd, t.season)) ??
    themes.find((t) => t.id === everyday) ??
    themes[0]
  );
}

export function activeTheme(themes: Theme[], pref: ThemePref, day: string): Theme | undefined {
  if (pref.selected !== 'auto') {
    const pinned = themes.find((t) => t.id === pref.selected);
    if (pinned) return pinned;
  }
  return autoTheme(themes, pref.everyday, day);
}

/** e.g. "October", or "Dec 20 – Jan 5" for ranges that aren't a whole month. */
export function seasonLabel(season: { start: string; end: string }): string {
  const [sm, sd] = season.start.split('-').map(Number);
  const [em, ed] = season.end.split('-').map(Number);
  // 2000 is a leap year, so February ends on the 29th (a season through 02-29 covers leap years).
  const lastDay = new Date(2000, em, 0).getDate();
  const month = (m: number, style: 'long' | 'short') =>
    new Date(2001, m - 1, 1).toLocaleString('en-US', { month: style });
  const wholeMonth = ed === lastDay || (em === 2 && ed === 28);
  if (sm === em && sd === 1 && wholeMonth) return month(sm, 'long');
  return `${month(sm, 'short')} ${sd} – ${month(em, 'short')} ${ed}`;
}

/**
 * Applies the wall's color/font theme by setting CSS custom properties on <html>. The app waits
 * for the server's theme before its first render (see `ready`), so the first frame is never a
 * stale one. The last theme is cached per screen as the fallback when the server is slow.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly clock = inject(ClockService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly themes = signal<Theme[]>([]);
  readonly pref = signal<ThemePref>({ selected: 'auto', everyday: 'dark' });
  readonly active = computed(() => activeTheme(this.themes(), this.pref(), this.clock.today()));
  readonly auto = computed(() =>
    autoTheme(this.themes(), this.pref().everyday, this.clock.today()),
  );

  private applied: string[] = [];
  private readonly timer = setInterval(() => this.load(), RELOAD_MS);
  private markLoaded = () => {};
  private readonly loaded = new Promise<void>((resolve) => (this.markLoaded = resolve));

  constructor() {
    if (!this.browser) return;
    const cached = readCache();
    if (cached) this.apply(cached);
    effect(() => {
      const t = this.active();
      if (!t) return;
      this.apply(t);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(t));
      } catch {}
    });
    this.load();
  }

  load() {
    this.http.get<ThemeResponse>('/api/config/theme').subscribe({
      next: (r) => {
        this.set(r);
        // Apply now rather than when the effect next runs, so the first render already has it.
        const t = this.active();
        if (t) this.apply(t);
        this.markLoaded();
      },
      error: () => this.markLoaded(),
    });
  }

  /** Resolves once the server's theme is applied, or after a short wait (keeping the cache). */
  ready(): Promise<void> {
    if (!this.browser) return Promise.resolve();
    return Promise.race([
      this.loaded,
      new Promise<void>((resolve) => setTimeout(resolve, FIRST_LOAD_WAIT_MS)),
    ]);
  }

  save(pref: Partial<ThemePref>) {
    const next = { ...this.pref(), ...pref };
    this.pref.set(next);
    return this.http.put<ThemeResponse>('/api/config/theme', next);
  }

  private set({ themes, selected, everyday }: ThemeResponse) {
    this.themes.set(themes);
    this.pref.set({ selected, everyday });
  }

  private apply(t: Theme) {
    const root = document.documentElement;
    for (const key of this.applied) root.style.removeProperty(key);
    for (const [key, value] of Object.entries(t.tokens)) root.style.setProperty(key, value);
    this.applied = Object.keys(t.tokens);
    root.style.colorScheme = t.scheme;
    root.dataset['theme'] = t.id;
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}

function readCache(): Theme | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Theme) : null;
  } catch {
    return null;
  }
}
