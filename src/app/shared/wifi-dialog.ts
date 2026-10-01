import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { Icon } from './icon';

interface WifiInfo {
  configured: boolean;
  ssid?: string;
  password?: string;
  security?: 'WPA' | 'WEP' | 'nopass';
}

/** Guest Wi-Fi: QR to scan plus the name and password spelled out. */
@Component({
  selector: 'app-wifi-dialog',
  imports: [Icon],
  template: `
    @if (open()) {
      <div class="backdrop" (click)="closed.emit()">
        <div class="panel" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <button type="button" class="close" aria-label="Close" (click)="closed.emit()">
            <app-icon name="close" />
          </button>
          <h2>Guest Wi-Fi</h2>
          @if (info(); as w) {
            @if (w.configured) {
              <img class="qr" [src]="qrUrl()" alt="Wi-Fi QR code" />
              <p class="muted">Point your phone's camera at the code.</p>
              <dl>
                <dt>Network</dt>
                <dd>{{ w.ssid }}</dd>
                @if (w.security !== 'nopass') {
                  <dt>Password</dt>
                  <dd class="pass">{{ w.password }}</dd>
                }
              </dl>
            } @else {
              <p class="muted">Not set up yet. Add the network in Settings → Guest Wi-Fi.</p>
            }
          }
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 110;
      display: grid;
      place-items: center;
      padding: 1rem;
      background: rgb(0 0 0 / 0.6);
    }
    .panel {
      position: relative;
      display: grid;
      justify-items: center;
      gap: 0.75rem;
      padding: 2rem 3rem;
      border-radius: var(--radius);
      background: var(--surface);
      text-align: center;
    }
    h2 {
      margin: 0;
      font-size: 1.8rem;
    }
    .close {
      all: unset;
      position: absolute;
      top: 1rem;
      right: 1rem;
      padding: 0.5rem;
      color: var(--text-muted);
      cursor: pointer;
    }
    .qr {
      width: 18rem;
      height: 18rem;
      padding: 0.75rem;
      border-radius: var(--radius-sm);
      background: #fff;
    }
    dl {
      display: grid;
      grid-template-columns: auto auto;
      gap: 0.4rem 1rem;
      margin: 0.5rem 0 0;
      font-size: 1.3rem;
      text-align: left;
      user-select: text;
    }
    dt {
      color: var(--text-muted);
    }
    dd {
      margin: 0;
      font-weight: 600;
    }
    .pass {
      font-family: ui-monospace, 'DejaVu Sans Mono', monospace;
      letter-spacing: 0.04em;
    }
  `,
})
export class WifiDialog {
  private readonly http = inject(HttpClient);
  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly info = signal<WifiInfo | null>(null);
  protected readonly qrUrl = signal('');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.qrUrl.set(`/api/config/wifi/qr.svg?v=${Date.now()}`);
      this.http.get<WifiInfo>('/api/config/wifi').subscribe({
        next: (w) => this.info.set(w),
        error: () => this.info.set({ configured: false }),
      });
    });
  }
}
