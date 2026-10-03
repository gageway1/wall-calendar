import { Theme, activeTheme, autoTheme, inSeason, seasonLabel } from './theme.service';

const theme = (id: string, season: Theme['season'] = null): Theme => ({
  id,
  name: id,
  scheme: 'dark',
  tokens: {},
  season,
});

const themes = [
  theme('dark'),
  theme('light'),
  theme('halloween', { start: '10-01', end: '10-31' }),
  theme('christmas', { start: '12-20', end: '01-05' }),
];

describe('inSeason', () => {
  it('includes both ends of a range', () => {
    const oct = { start: '10-01', end: '10-31' };
    expect(inSeason('10-01', oct)).toBe(true);
    expect(inSeason('10-31', oct)).toBe(true);
    expect(inSeason('09-30', oct)).toBe(false);
    expect(inSeason('11-01', oct)).toBe(false);
  });

  it('wraps past New Year', () => {
    const xmas = { start: '12-20', end: '01-05' };
    expect(inSeason('12-25', xmas)).toBe(true);
    expect(inSeason('01-03', xmas)).toBe(true);
    expect(inSeason('01-06', xmas)).toBe(false);
    expect(inSeason('12-19', xmas)).toBe(false);
  });
});

describe('activeTheme', () => {
  it('Automatic uses the seasonal theme on its dates', () => {
    expect(activeTheme(themes, { selected: 'auto', everyday: 'light' }, '2026-10-15')?.id).toBe(
      'halloween',
    );
    expect(activeTheme(themes, { selected: 'auto', everyday: 'light' }, '2027-01-02')?.id).toBe(
      'christmas',
    );
  });

  it('Automatic falls back to the everyday theme', () => {
    expect(activeTheme(themes, { selected: 'auto', everyday: 'light' }, '2026-11-15')?.id).toBe(
      'light',
    );
  });

  it('a pinned theme overrides the season', () => {
    expect(activeTheme(themes, { selected: 'dark', everyday: 'light' }, '2026-10-15')?.id).toBe(
      'dark',
    );
  });

  it('an unknown pinned theme falls back to Automatic', () => {
    expect(activeTheme(themes, { selected: 'gone', everyday: 'light' }, '2026-10-15')?.id).toBe(
      'halloween',
    );
  });

  it('returns nothing until themes load', () => {
    expect(autoTheme([], 'dark', '2026-10-15')).toBeUndefined();
  });
});

describe('seasonLabel', () => {
  it('names whole months', () => {
    expect(seasonLabel({ start: '10-01', end: '10-31' })).toBe('October');
    expect(seasonLabel({ start: '02-01', end: '02-28' })).toBe('February');
    expect(seasonLabel({ start: '02-01', end: '02-29' })).toBe('February');
  });

  it('shows partial ranges as dates', () => {
    expect(seasonLabel({ start: '12-20', end: '01-05' })).toBe('Dec 20 – Jan 5');
  });
});
