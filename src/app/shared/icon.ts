import { Component, input } from '@angular/core';

export type IconName =
  | 'home'
  | 'week'
  | 'month'
  | 'chores'
  | 'meals'
  | 'lists'
  | 'settings'
  | 'left'
  | 'right'
  | 'close'
  | 'plus'
  | 'timer'
  | 'wifi';

/** Tiny inline stroke icon set, so the kiosk needs no icon font or network. */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('home') {
          <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M9 22V12h6v10" />
        }
        @case ('week') {
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16M15 4v16" />
        }
        @case ('month') {
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        }
        @case ('settings') {
          <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
        }
        @case ('left') {
          <path d="M15 18l-6-6 6-6" />
        }
        @case ('right') {
          <path d="M9 18l6-6-6-6" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('chores') {
          <path d="M9 11l3 3 9-9" />
          <path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        }
        @case ('meals') {
          <path d="M7 2v20M4 2v6a3 3 0 0 0 6 0V2M17 22V2c-2.5 1.5-3.5 4.5-3.5 8H17" />
        }
        @case ('lists') {
          <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />
        }
        @case ('timer') {
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5M9 2h6" />
        }
        @case ('wifi') {
          <path
            d="M5 12.55a11 11 0 0 1 14 0M1.5 9a16 16 0 0 1 21 0M8.5 16.1a6 6 0 0 1 7 0M12 20h.01"
          />
        }
        @case ('close') {
          <path d="M18 6L6 18M6 6l12 12" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 1.5em;
      height: 1.5em;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
}
