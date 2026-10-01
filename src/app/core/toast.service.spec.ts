import { TestBed } from '@angular/core/testing';
import { GENERIC_ERROR, ToastService } from './toast.service';

describe('ToastService', () => {
  let toasts: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    // 16px rem → each toast slot is 88px; 600px viewport leaves room for 5.
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('auto-dismisses success after 4s (plus the leave animation)', () => {
    toasts.success('Saved');
    expect(toasts.visible().length).toBe(1);
    vi.advanceTimersByTime(4000);
    expect(toasts.visible()[0].leaving).toBe(true);
    vi.advanceTimersByTime(200);
    expect(toasts.visible().length).toBe(0);
  });

  it('keeps errors until dismissed', () => {
    toasts.error();
    vi.advanceTimersByTime(60_000);
    expect(toasts.visible().map((t) => t.message)).toEqual([GENERIC_ERROR]);
    toasts.dismiss(toasts.visible()[0].id);
    vi.advanceTimersByTime(200);
    expect(toasts.visible().length).toBe(0);
  });

  it('merges identical toasts into one with a count', () => {
    for (let i = 0; i < 50; i++) toasts.error();
    expect(toasts.visible().length).toBe(1);
    expect(toasts.visible()[0].count).toBe(50);
    expect(toasts.queued()).toBe(0);
  });

  it('a duplicate restarts the countdown', () => {
    toasts.success('Saved');
    vi.advanceTimersByTime(3000);
    toasts.success('Saved');
    vi.advanceTimersByTime(3000);
    expect(toasts.visible()[0].leaving).toBe(false);
    expect(toasts.visible()[0].version).toBe(1);
  });

  it('shows only what fits and queues the rest, promoting as space frees', () => {
    for (let i = 1; i <= 12; i++) toasts.error(`Error ${i}`);
    expect(toasts.visible().length).toBe(5);
    expect(toasts.queued()).toBe(7);

    toasts.dismiss(toasts.visible()[0].id);
    vi.advanceTimersByTime(200);
    expect(toasts.visible().length).toBe(5);
    expect(toasts.queued()).toBe(6);
    expect(toasts.visible().at(-1)?.message).toBe('Error 6');
  });

  it('merges duplicates inside the queue too', () => {
    for (let i = 1; i <= 5; i++) toasts.error(`Error ${i}`);
    for (let i = 0; i < 20; i++) toasts.warn('Offline');
    expect(toasts.queued()).toBe(1);
  });

  it('clear() empties everything', () => {
    for (let i = 1; i <= 12; i++) toasts.error(`Error ${i}`);
    toasts.clear();
    vi.advanceTimersByTime(200);
    expect(toasts.visible().length).toBe(0);
    expect(toasts.queued()).toBe(0);
  });
});
