import { Component, inject } from '@angular/core';
import { PeopleService } from '../core/people.service';

/** Tap a person to hide/show their events. */
@Component({
  selector: 'app-person-filter',
  template: `
    @for (p of people.people(); track p.id) {
      <button
        type="button"
        class="chip"
        [class.off]="people.hidden().has(p.id)"
        [style.--c]="p.color"
        (click)="people.toggle(p.id)"
      >
        <span class="dot"></span>{{ p.name }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .chip {
      all: unset;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--c) 22%, var(--surface));
      cursor: pointer;
      font-weight: 500;
    }
    .dot {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 50%;
      background: var(--c);
    }
    .off {
      background: var(--surface);
      color: var(--text-muted);
      text-decoration: line-through;
      .dot {
        background: transparent;
        box-shadow: inset 0 0 0 2px var(--c);
      }
    }
  `,
})
export class PersonFilter {
  protected readonly people = inject(PeopleService);
}
