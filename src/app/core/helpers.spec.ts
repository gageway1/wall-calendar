import { toLocalDate } from './clock.service';
import { describeWeather } from './weather.service';

describe('toLocalDate', () => {
  it('formats in local time with zero padding', () => {
    expect(toLocalDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('describeWeather', () => {
  it('maps WMO codes', () => {
    expect(describeWeather(0).label).toBe('Clear');
    expect(describeWeather(0, false).icon).toBe('🌙');
    expect(describeWeather(63).label).toBe('Rain');
    expect(describeWeather(75).label).toBe('Snow');
    expect(describeWeather(95).label).toBe('Thunderstorms');
  });
});
