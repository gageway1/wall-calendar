import { Directive, output } from '@angular/core';

const MIN_DISTANCE = 80;

/** Horizontal swipe detection for touch and mouse. Vertical scrolling still works. */
@Directive({
  selector: '[appSwipe]',
  host: {
    style: 'touch-action: pan-y',
    '(pointerdown)': 'down($event)',
    '(pointerup)': 'up($event)',
    '(pointercancel)': 'start = undefined',
  },
})
export class Swipe {
  readonly swipeLeft = output<void>();
  readonly swipeRight = output<void>();

  protected start?: { x: number; y: number };

  protected down(e: PointerEvent) {
    this.start = { x: e.clientX, y: e.clientY };
  }

  protected up(e: PointerEvent) {
    if (!this.start) return;
    const dx = e.clientX - this.start.x;
    const dy = e.clientY - this.start.y;
    this.start = undefined;
    if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    (dx < 0 ? this.swipeLeft : this.swipeRight).emit();
  }
}
