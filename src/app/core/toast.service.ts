import { isPlatformBrowser } from '@angular/common';
import { Injectable, OnDestroy, PLATFORM_ID, computed, inject, signal } from '@angular/core';

export type ToastKind = 'success' | 'warn' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** How many identical toasts this one stands for. */
  count: number;
  /** Auto-dismiss time in ms; null = stays until closed (errors). */
  duration: number | null;
  /** Bumped when a duplicate restarts the countdown, to restart the bar animation. */
  version: number;
  leaving: boolean;
}

export const GENERIC_ERROR = 'Oops! Something went wrong.';

const DURATION: Record<ToastKind, number | null> = { success: 4000, warn: 7000, error: null };
const LEAVE_MS = 200;

/** Kept in sync with .toast height + gap in toasts.scss, in rem. */
const TOAST_REM = 4.75 + 0.75;
const TOP_REM = 1.5;

/**
 * Top-right toast stack. Identical toasts merge (×N) instead of stacking, and only as many as fit
 * on screen are shown; the rest wait in a queue and slide in as earlier ones close.
 */
@Injectable({ providedIn: 'root' })
export class ToastService implements OnDestroy {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  // The build pre-boots the app on the server to extract routes, where there is no window.
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly viewportHeight = signal(this.browser ? window.innerHeight : 1080);
  private readonly onResize = () => this.viewportHeight.set(window.innerHeight);

  readonly visible = signal<Toast[]>([]);
  private readonly queue = signal<Toast[]>([]);
  readonly queued = computed(() => this.queue().length);

  /** viewHeight / toastHeight, leaving room for the "+N more" note. */
  private readonly capacity = computed(() => {
    const rem =
      (this.browser && parseFloat(getComputedStyle(document.documentElement).fontSize)) || 16;
    const usable = this.viewportHeight() - TOP_REM * 2 * rem - 2 * rem;
    return Math.max(1, Math.floor(usable / (TOAST_REM * rem)));
  });

  constructor() {
    if (this.browser) window.addEventListener('resize', this.onResize);
  }

  success(message: string) {
    this.show('success', message);
  }

  warn(message: string) {
    this.show('warn', message);
  }

  error(message = GENERIC_ERROR) {
    this.show('error', message);
  }

  show(kind: ToastKind, message: string) {
    // Same toast already up: count it and restart its clock instead of adding another.
    const dup = this.visible().find((t) => t.kind === kind && t.message === message && !t.leaving);
    if (dup) {
      this.patch(dup.id, { count: dup.count + 1, version: dup.version + 1 });
      this.schedule(dup.id, kind);
      return;
    }
    const queuedDup = this.queue().find((t) => t.kind === kind && t.message === message);
    if (queuedDup) {
      this.queue.update((q) => q.map((t) => (t === queuedDup ? { ...t, count: t.count + 1 } : t)));
      return;
    }

    const toast: Toast = {
      id: this.nextId++,
      kind,
      message,
      count: 1,
      duration: DURATION[kind],
      version: 0,
      leaving: false,
    };
    if (this.visible().length < this.capacity()) this.display(toast);
    else this.queue.update((q) => [...q, toast]);
  }

  dismiss(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.patch(id, { leaving: true });
    setTimeout(() => {
      this.visible.update((v) => v.filter((t) => t.id !== id));
      this.promote();
    }, LEAVE_MS);
  }

  clear() {
    this.queue.set([]);
    for (const t of this.visible()) this.dismiss(t.id);
  }

  private display(toast: Toast) {
    this.visible.update((v) => [...v, toast]);
    this.schedule(toast.id, toast.kind);
  }

  private promote() {
    while (this.queue().length && this.visible().length < this.capacity()) {
      const [next, ...rest] = this.queue();
      this.queue.set(rest);
      this.display(next);
    }
  }

  private schedule(id: number, kind: ToastKind) {
    const ms = DURATION[kind];
    if (ms === null) return;
    clearTimeout(this.timers.get(id));
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), ms),
    );
  }

  private patch(id: number, changes: Partial<Toast>) {
    this.visible.update((v) => v.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  }

  ngOnDestroy() {
    if (this.browser) window.removeEventListener('resize', this.onResize);
    for (const t of this.timers.values()) clearTimeout(t);
  }
}
