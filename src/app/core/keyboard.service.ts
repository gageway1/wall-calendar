import { Injectable, signal } from '@angular/core';

export type KeyboardMode = 'builtin' | 'system';
const KEY = 'wall.keyboard';

/**
 * Which on-screen keyboard text fields use. `builtin` draws our own and suppresses the OS one
 * (needed on the Linux kiosk, which has none); `system` defers to e.g. an Android tablet's keyboard.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardService {
  readonly mode = signal<KeyboardMode>(load());

  set(mode: KeyboardMode) {
    this.mode.set(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {}
  }
}

function load(): KeyboardMode {
  try {
    return localStorage.getItem(KEY) === 'system' ? 'system' : 'builtin';
  } catch {
    return 'builtin';
  }
}
