import { niceCase, noSchoolLabel, parseDiningPage, parseMenusJson, resolveDevalue } from './parse';

// Same shape as the real Southwest Elementary page (trimmed): flat devalue array, objects point
// at other entries by index, and identical strings are shared.
const PAYLOAD = [
  ['ShallowReactive', 1],
  { data: 2, state: 15 },
  ['ShallowReactive', 3],
  { dining: 4 },
  { selectedFilter: 5, menus: 6 },
  '49256',
  [7, 13],
  { id: 8, name: 9, breakfast: 10, lunch: 11, dinner: 12, date: 16 },
  6333799,
  '2026-10-01',
  'CINNAMON ROLL\nCEREAL\nMILK',
  'UNCRUSTABLE BASKET\nROTINI AND BREADSTICK\nCUCUMBERS\nMILK',
  '',
  { id: 14, name: 17, breakfast: 18, lunch: 19, dinner: 12, date: 16 },
  6333849,
  {},
  'OCT 01, 2026',
  '2026-10-12',
  'FALL BREAK',
  'NO SCHOOL',
];
const page = (payload: unknown) =>
  `<html><body><div>menu</div><script type="application/json" data-nuxt-data="nuxt-app" id="__NUXT_DATA__">${JSON.stringify(payload)}</script></body></html>`;

describe('school lunch parsing', () => {
  it('resolves the devalue payload', () => {
    const v = resolveDevalue(PAYLOAD) as any;
    expect(v.data.dining.selectedFilter).toBe('49256');
    expect(v.data.dining.menus).toHaveLength(2);
  });

  it('extracts each day with breakfast and lunch lines', () => {
    expect(parseDiningPage(page(PAYLOAD))).toEqual([
      {
        day: '2026-10-01',
        breakfast: ['CINNAMON ROLL', 'CEREAL', 'MILK'],
        lunch: ['UNCRUSTABLE BASKET', 'ROTINI AND BREADSTICK', 'CUCUMBERS', 'MILK'],
      },
      { day: '2026-10-12', breakfast: ['FALL BREAK'], lunch: ['NO SCHOOL'] },
    ]);
  });

  it('fails loudly if the site changes shape', () => {
    expect(() => parseDiningPage('<html>nothing here</html>')).toThrow(/__NUXT_DATA__/);
    expect(() => parseDiningPage(page([{ data: 1 }, {}]))).toThrow(/no menus/);
  });

  it('formats lines and spots no-school days', () => {
    expect(niceCase('UNCRUSTABLE BASKET')).toBe('Uncrustable basket');
    expect(niceCase('BBQ RIB SANDWICH')).toBe('BBQ rib sandwich');
    expect(noSchoolLabel({ day: 'x', breakfast: ['FALL BREAK'], lunch: ['NO SCHOOL'] })).toBe(
      'Fall break',
    );
    expect(noSchoolLabel({ day: 'x', breakfast: ['CEREAL'], lunch: ['PIZZA'] })).toBeNull();
  });

  it('reads the Thrillshare menus API, including the next-page link', () => {
    const page = parseMenusJson({
      menus: [
        {
          id: 1,
          name: '2026-10-29',
          breakfast: 'CEREAL\nMILK',
          lunch: 'PRETZEL AND CHEESE \nMILK',
          dinner: '',
        },
        { id: 2, name: 'not-a-date', lunch: 'x' },
      ],
      meta: { links: { next: 'https://example/api?page_no=2' } },
    });
    expect(page.days).toEqual([
      { day: '2026-10-29', breakfast: ['CEREAL', 'MILK'], lunch: ['PRETZEL AND CHEESE', 'MILK'] },
    ]);
    expect(page.next).toBe('https://example/api?page_no=2');
    expect(parseMenusJson({ menus: [], meta: { links: {} } }).next).toBeNull();
    expect(() => parseMenusJson({ error: 'nope' })).toThrow(/no menus/);
  });
});
