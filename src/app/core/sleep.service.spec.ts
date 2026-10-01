import { inWindow } from './sleep.service';

const at = (h: number, m = 0) => h * 60 + m;

describe('inWindow', () => {
  it('handles a window that wraps past midnight (10pm to 6am)', () => {
    const [s, e] = [at(22), at(6)];
    expect(inWindow(at(21, 59), s, e)).toBe(false);
    expect(inWindow(at(22), s, e)).toBe(true);
    expect(inWindow(at(0), s, e)).toBe(true);
    expect(inWindow(at(5, 59), s, e)).toBe(true);
    expect(inWindow(at(6), s, e)).toBe(false);
    expect(inWindow(at(12), s, e)).toBe(false);
  });

  it('handles a same-day window (1pm to 3pm)', () => {
    expect(inWindow(at(13), at(13), at(15))).toBe(true);
    expect(inWindow(at(14, 59), at(13), at(15))).toBe(true);
    expect(inWindow(at(15), at(13), at(15))).toBe(false);
    expect(inWindow(at(0), at(13), at(15))).toBe(false);
  });
});
