import { entrees } from './lunch.service';

describe('entrees', () => {
  const day = (lunch: string[]) => ({ day: '2026-10-01', lunch, breakfast: [], noSchool: null });

  it('joins the two entrée choices', () => {
    expect(entrees(day(['Uncrustable basket', 'Rotini and breadstick', 'Peas']))).toBe(
      'Uncrustable basket or rotini and breadstick',
    );
  });

  it('keeps abbreviations intact', () => {
    expect(entrees(day(['Chicken pot stickers', 'BBQ rib sandwich']))).toBe(
      'Chicken pot stickers or BBQ rib sandwich',
    );
  });

  it('handles a single item', () => {
    expect(entrees(day(['Pizza']))).toBe('Pizza');
  });
});
