import { Component, OnDestroy, computed, input, output, signal } from '@angular/core';

export type OskKey = { type: 'char'; value: string } | { type: 'backspace' } | { type: 'done' };

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
];

const REPEAT_DELAY_MS = 450;
const REPEAT_EVERY_MS = 60;

/**
 * Built-in on-screen keyboard. Keys fire on pointerdown (snappier on touch, and never steals focus
 * from the text field). Shift is one-shot; `autoCap` capitalizes the start of a sentence.
 */
@Component({
  selector: 'app-osk',
  templateUrl: './osk.html',
  styleUrl: './osk.scss',
})
export class Osk implements OnDestroy {
  readonly autoCap = input(false);
  readonly key = output<OskKey>();

  protected readonly rows = ROWS;
  protected readonly shift = signal(false);
  protected readonly upper = computed(() => this.shift() || this.autoCap());

  private repeatTimer?: ReturnType<typeof setTimeout>;

  protected label(k: string) {
    return this.upper() ? k.toUpperCase() : k;
  }

  protected press(e: PointerEvent, k: string) {
    e.preventDefault();
    this.key.emit({ type: 'char', value: this.label(k) });
    this.shift.set(false);
  }

  protected space(e: PointerEvent) {
    e.preventDefault();
    this.key.emit({ type: 'char', value: ' ' });
  }

  protected toggleShift(e: PointerEvent) {
    e.preventDefault();
    this.shift.update((s) => !s);
  }

  protected done() {
    this.key.emit({ type: 'done' });
  }

  /** Backspace repeats while held, like a real keyboard. */
  protected backspaceDown(e: PointerEvent) {
    e.preventDefault();
    this.key.emit({ type: 'backspace' });
    this.stopRepeat();
    const tick = () => {
      this.key.emit({ type: 'backspace' });
      this.repeatTimer = setTimeout(tick, REPEAT_EVERY_MS);
    };
    this.repeatTimer = setTimeout(tick, REPEAT_DELAY_MS);
  }

  protected stopRepeat() {
    clearTimeout(this.repeatTimer);
    this.repeatTimer = undefined;
  }

  ngOnDestroy() {
    this.stopRepeat();
  }
}
