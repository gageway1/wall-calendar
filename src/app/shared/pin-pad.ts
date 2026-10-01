import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { PinService } from '../core/pin.service';

const MIN = 4;
const MAX = 8;

/** Big touch number pad for the parent PIN: verify an existing one, or create a new one. */
@Component({
  selector: 'app-pin-pad',
  templateUrl: './pin-pad.html',
  styleUrl: './pin-pad.scss',
  host: { '(document:keydown)': 'onKeyboard($event)' },
})
export class PinPad implements OnDestroy {
  protected readonly pins = inject(PinService);

  protected readonly digits = signal('');
  protected readonly message = signal<string | null>(null);
  protected readonly shake = signal(false);
  protected readonly lockedFor = signal(0);
  protected readonly checking = signal(false);
  /** Create mode: the first entry, while asking to confirm it. */
  private readonly firstEntry = signal<string | null>(null);
  private countdown?: ReturnType<typeof setInterval>;

  protected readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  constructor() {
    // Fresh pad every time it opens.
    effect(() => {
      this.pins.request();
      this.digits.set('');
      this.message.set(null);
      this.firstEntry.set(null);
    });
  }

  protected readonly heading = computed(() => {
    const r = this.pins.request();
    if (r?.mode === 'create') return this.firstEntry() ? 'Enter it again' : r.title;
    return r?.title ?? '';
  });

  /** Dots to draw: fixed length when verifying, growing when creating. */
  protected readonly dots = computed(() => {
    const r = this.pins.request();
    const n = r?.mode === 'verify' ? r.length : Math.max(MIN, this.digits().length);
    return Array.from({ length: n }, (_, i) => i < this.digits().length);
  });

  protected readonly canConfirm = computed(
    () => this.pins.request()?.mode === 'create' && this.digits().length >= MIN,
  );

  protected press(d: string) {
    const r = this.pins.request();
    if (!r || this.lockedFor() || this.checking()) return;
    const max = r.mode === 'verify' ? r.length : MAX;
    if (this.digits().length >= max) return;
    this.message.set(null);
    this.digits.update((v) => v + d);
    if (r.mode === 'verify' && this.digits().length === r.length) void this.check();
  }

  protected backspace() {
    this.digits.update((v) => v.slice(0, -1));
  }

  protected confirm() {
    if (!this.canConfirm()) return;
    const first = this.firstEntry();
    if (first === null) {
      this.firstEntry.set(this.digits());
      this.digits.set('');
    } else if (first === this.digits()) {
      this.pins.finish(first);
    } else {
      this.firstEntry.set(null);
      this.fail("Those didn't match. Start again.");
    }
  }

  private async check() {
    this.checking.set(true);
    try {
      const res = await this.pins.verify(this.digits());
      if (res.ok) {
        this.pins.finish(true);
      } else if (res.lockedFor) {
        this.startLockout(res.lockedFor);
      } else {
        this.fail('Wrong PIN');
      }
    } catch {
      this.fail("Couldn't check the PIN. Try again.");
    } finally {
      this.checking.set(false);
    }
  }

  private fail(message: string) {
    this.message.set(message);
    this.digits.set('');
    this.shake.set(true);
    setTimeout(() => this.shake.set(false), 400);
  }

  private startLockout(seconds: number) {
    this.digits.set('');
    this.lockedFor.set(seconds);
    this.message.set(null);
    clearInterval(this.countdown);
    this.countdown = setInterval(() => {
      this.lockedFor.update((s) => Math.max(0, s - 1));
      if (!this.lockedFor()) clearInterval(this.countdown);
    }, 1000);
  }

  /** Physical keyboard works too (handy on a PC). */
  protected onKeyboard(e: KeyboardEvent) {
    if (!this.pins.request()) return;
    if (/^\d$/.test(e.key)) this.press(e.key);
    else if (e.key === 'Backspace') this.backspace();
    else if (e.key === 'Enter') this.confirm();
    else if (e.key === 'Escape') this.pins.cancel();
  }

  ngOnDestroy() {
    clearInterval(this.countdown);
  }
}
