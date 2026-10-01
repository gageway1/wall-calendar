import { Lockout, PIN_FORMAT, hashPin, pinMatches } from './pin';

describe('PIN', () => {
  it('hashes with a salt and verifies', () => {
    const stored = hashPin('2468');
    expect(stored).not.toContain('2468');
    expect(pinMatches('2468', stored)).toBe(true);
    expect(pinMatches('2469', stored)).toBe(false);
    expect(hashPin('2468')).not.toBe(stored); // different salt each time
    expect(pinMatches('2468', 'garbage')).toBe(false);
  });

  it('accepts 4 to 8 digits only', () => {
    expect(PIN_FORMAT.test('1234')).toBe(true);
    expect(PIN_FORMAT.test('12345678')).toBe(true);
    expect(PIN_FORMAT.test('123')).toBe(false);
    expect(PIN_FORMAT.test('12a4')).toBe(false);
  });

  it('locks for 30s after 5 straight failures', () => {
    const l = new Lockout();
    for (let i = 0; i < 4; i++) l.record(false, 0);
    expect(l.remaining(0)).toBe(0);
    l.record(false, 0);
    expect(l.remaining(0)).toBe(30_000);
    expect(l.remaining(29_999)).toBe(1);
    expect(l.remaining(30_000)).toBe(0);
  });

  it('a success resets the failure count', () => {
    const l = new Lockout();
    for (let i = 0; i < 4; i++) l.record(false, 0);
    l.record(true, 0);
    for (let i = 0; i < 4; i++) l.record(false, 0);
    expect(l.remaining(0)).toBe(0);
  });
});
