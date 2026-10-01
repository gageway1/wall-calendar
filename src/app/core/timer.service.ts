import { Injectable, computed, inject, signal } from '@angular/core';
import { ClockService } from './clock.service';

interface TimerState {
  totalMs: number;
  /** Set while running. */
  endsAt: number | null;
  /** Set while paused. */
  pausedRemainingMs: number | null;
}

const CHIME_EVERY_MS = 2500;
const CHIME_FOR_MS = 60 * 1000;

/** One kid-friendly countdown timer for the whole wall. */
@Injectable({ providedIn: 'root' })
export class TimerService {
  private readonly clock = inject(ClockService);
  private readonly state = signal<TimerState | null>(null);
  readonly panelOpen = signal(false);
  readonly done = signal(false);

  private audio?: AudioContext;
  private chimeTimer?: ReturnType<typeof setInterval>;

  readonly active = computed(() => this.state() !== null);
  readonly paused = computed(() => this.state()?.pausedRemainingMs != null);

  readonly remainingMs = computed(() => {
    const s = this.state();
    if (!s) return 0;
    if (s.pausedRemainingMs != null) return s.pausedRemainingMs;
    return Math.max(0, (s.endsAt ?? 0) - this.clock.now().getTime());
  });

  /** 1 → 0 as time runs out. */
  readonly fraction = computed(() => {
    const s = this.state();
    return s ? this.remainingMs() / s.totalMs : 0;
  });

  readonly label = computed(() => formatClock(this.remainingMs()));

  constructor() {
    // Ticks with the app clock; fire once when a running timer reaches zero.
    setInterval(() => {
      const s = this.state();
      if (s?.endsAt && Date.now() >= s.endsAt) this.finish();
    }, 250);
  }

  start(minutes: number) {
    // Created on a tap so the browser allows sound later.
    this.audio ??= new AudioContext();
    void this.audio.resume();
    const totalMs = minutes * 60_000;
    this.state.set({ totalMs, endsAt: Date.now() + totalMs, pausedRemainingMs: null });
    this.dismissDone();
  }

  pause() {
    const s = this.state();
    if (!s?.endsAt) return;
    this.state.set({ ...s, endsAt: null, pausedRemainingMs: Math.max(0, s.endsAt - Date.now()) });
  }

  resume() {
    const s = this.state();
    if (s?.pausedRemainingMs == null) return;
    this.state.set({ ...s, endsAt: Date.now() + s.pausedRemainingMs, pausedRemainingMs: null });
  }

  addMinute() {
    const s = this.state();
    if (!s) return;
    if (s.pausedRemainingMs != null) {
      this.state.set({
        ...s,
        totalMs: s.totalMs + 60_000,
        pausedRemainingMs: s.pausedRemainingMs + 60_000,
      });
    } else if (s.endsAt) {
      this.state.set({ ...s, totalMs: s.totalMs + 60_000, endsAt: s.endsAt + 60_000 });
    }
  }

  stop() {
    this.state.set(null);
  }

  dismissDone() {
    this.done.set(false);
    clearInterval(this.chimeTimer);
  }

  private finish() {
    this.state.set(null);
    this.panelOpen.set(false);
    this.done.set(true);
    this.chime();
    const started = Date.now();
    clearInterval(this.chimeTimer);
    this.chimeTimer = setInterval(() => {
      if (Date.now() - started > CHIME_FOR_MS) clearInterval(this.chimeTimer);
      else this.chime();
    }, CHIME_EVERY_MS);
  }

  /** Three soft rising beeps, synthesized so there's no sound file to ship. */
  private chime() {
    const ctx = this.audio;
    if (!ctx) return;
    [660, 880, 1100].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
