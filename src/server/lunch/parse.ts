/**
 * School dining menus from Apptegy/Thrillshare school sites (e.g. gws.k12.in.us/o/swe/dining).
 *
 * Preferred source: the public JSON API the site itself loads from
 * (thrillshare-cmsv2.services.thrillshare.com/api/v2/s/<section>/menus?query_id=<filter>).
 * Fallback: the dining page, which is server-rendered by Nuxt and embeds the same data as a
 * "devalue" payload in <script id="__NUXT_DATA__"> (a flat array whose entries refer to each
 * other by index). Note the page may sit behind a browser check; the API doesn't.
 */

export interface SchoolMenuDay {
  day: string; // YYYY-MM-DD
  breakfast: string[];
  lunch: string[];
}

const WRAPPERS = new Set([
  'Reactive',
  'ShallowReactive',
  'Ref',
  'ShallowRef',
  'EmptyRef',
  'EmptyShallowRef',
]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolves a Nuxt devalue payload into plain JS values. */
export function resolveDevalue(payload: unknown[]): unknown {
  const cache = new Map<number, unknown>();
  const resolve = (i: number, depth = 0): unknown => {
    if (typeof i !== 'number' || depth > 200) return undefined;
    if (cache.has(i)) return cache.get(i);
    const v = payload[i];
    let out: unknown = v;
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string' && WRAPPERS.has(v[0])) out = resolve(v[1] as number, depth + 1);
      else if (typeof v[0] === 'string')
        out = undefined; // Date/Set/Map etc.: not used here
      else out = v.map((x) => resolve(x as number, depth + 1));
    } else if (v && typeof v === 'object') {
      const obj: Record<string, unknown> = {};
      cache.set(i, obj);
      for (const [k, idx] of Object.entries(v)) obj[k] = resolve(idx as number, depth + 1);
      out = obj;
    }
    cache.set(i, out);
    return out;
  };
  return resolve(0);
}

const lines = (s: unknown) =>
  typeof s === 'string'
    ? s
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

/** One page of the Thrillshare menus API: `{ menus: [{ name: 'YYYY-MM-DD', breakfast, lunch }], meta }`. */
export function parseMenusJson(json: unknown): { days: SchoolMenuDay[]; next: string | null } {
  const j = json as { menus?: unknown[]; meta?: { links?: { next?: string } } };
  if (!Array.isArray(j?.menus)) throw new Error('menus API response has no menus');
  return { days: toDays(j.menus), next: j.meta?.links?.next ?? null };
}

function toDays(menus: unknown[]): SchoolMenuDay[] {
  return menus
    .map((raw) => raw as { name?: unknown; breakfast?: unknown; lunch?: unknown })
    .filter((x) => typeof x?.name === 'string' && DATE.test(x.name))
    .map((x) => ({ day: x.name as string, breakfast: lines(x.breakfast), lunch: lines(x.lunch) }));
}

/** Extracts every menu day the page shows. Throws if the page no longer has the expected data. */
export function parseDiningPage(html: string): SchoolMenuDay[] {
  const m = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('dining page has no __NUXT_DATA__ payload');
  const data = resolveDevalue(JSON.parse(m[1])) as { data?: { dining?: { menus?: unknown[] } } };
  const menus = data?.data?.dining?.menus;
  if (!Array.isArray(menus)) throw new Error('dining payload has no menus');

  return toDays(menus);
}

const KEEP_UPPER = new Set(['BBQ', 'PB&J', 'PBJ', 'BLT']);

/** "UNCRUSTABLE BASKET" → "Uncrustable basket"; keeps BBQ and friends. */
export function niceCase(line: string): string {
  const words = line
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w));
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** No-school days are posted as e.g. breakfast "FALL BREAK", lunch "NO SCHOOL". */
export function noSchoolLabel(m: SchoolMenuDay): string | null {
  const all = [...m.breakfast, ...m.lunch];
  if (!all.some((l) => /no school|school closed/i.test(l))) return null;
  const reason = all.find((l) => !/no school|school closed/i.test(l));
  return reason ? niceCase(reason) : 'No school';
}
