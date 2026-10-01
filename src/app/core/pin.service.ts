import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface PinStatus {
  set: boolean;
  length: number | null;
}

export type PinPadRequest =
  | { mode: 'verify'; title: string; length: number; resolve: (ok: boolean) => void }
  | { mode: 'create'; title: string; resolve: (pin: string | null) => void };

/**
 * The parent PIN. Keeps kids out of Settings and out of editing their own chores. A speed bump,
 * not security: the check happens in the app, and it's fine that the API itself is open.
 */
@Injectable({ providedIn: 'root' })
export class PinService {
  private readonly http = inject(HttpClient);

  readonly status = signal<PinStatus | null>(null);
  /** What the PIN pad is currently asking for, if anything. */
  readonly request = signal<PinPadRequest | null>(null);

  async load(): Promise<PinStatus> {
    try {
      const s = await firstValueFrom(this.http.get<PinStatus>('/api/pin'));
      this.status.set(s);
      return s;
    } catch {
      // Can't reach the box: don't lock the family out of anything.
      return { set: false, length: null };
    }
  }

  /** Resolves true once the right PIN is entered (or immediately if no PIN is set). */
  async require(title = 'Enter parent PIN'): Promise<boolean> {
    const s = this.status() ?? (await this.load());
    if (!s.set || !s.length) return true;
    if (this.request()) this.cancel();
    return new Promise((resolve) =>
      this.request.set({ mode: 'verify', title, length: s.length!, resolve }),
    );
  }

  /** Asks for a new PIN twice; saves it and resolves true if set. */
  async create(): Promise<boolean> {
    const pin = await new Promise<string | null>((resolve) =>
      this.request.set({ mode: 'create', title: 'New parent PIN', resolve }),
    );
    if (!pin) return false;
    await firstValueFrom(this.http.put('/api/pin', { pin }));
    await this.load();
    return true;
  }

  async remove() {
    await firstValueFrom(this.http.delete('/api/pin'));
    await this.load();
  }

  verify(pin: string) {
    return firstValueFrom(
      this.http.post<{ ok: boolean; lockedFor?: number }>('/api/pin/verify', { pin }),
    );
  }

  /** Called by the pad when it finishes. */
  finish(result: boolean | string | null) {
    const r = this.request();
    this.request.set(null);
    if (!r) return;
    if (r.mode === 'verify') r.resolve(result === true);
    else r.resolve(typeof result === 'string' ? result : null);
  }

  cancel() {
    this.finish(null);
  }
}
