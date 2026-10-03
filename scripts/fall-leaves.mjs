// Generates the Fall nav falling-leaves tile into public/themes/fall: node scripts/fall-leaves.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/themes/fall', import.meta.url));
const W = 130; // Tile size (px in the SVG; scaled by the CSS background-size).
const H = 170;
const LEAVES = 9;
const COLORS = ['#d9452b', '#e9a23b', '#c46a1b', '#9a5b2a', '#f2c14e'];

// Deterministic jitter so the pattern never changes between runs.
let seed = 29;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const f = (n) => n.toFixed(1);

// A pointed leaf along the y axis, tip at -1, stem end at +1, with a midrib and short stem.
const LEAF = 'M0 -1C0.62 -0.55 0.62 0.45 0 1C-0.62 0.45 -0.62 -0.55 0 -1Z';
const RIB = 'M0 -0.75L0 1.35';

let body = '';
for (let i = 0; i < LEAVES; i++) {
  const size = 5 + rand() * 6;
  // Keep leaves off the tile edges so the repeat has no seams.
  const m = size * 1.5;
  const x = m + rand() * (W - 2 * m);
  const y = m + rand() * (H - 2 * m);
  const color = COLORS[Math.floor(rand() * COLORS.length)];
  body +=
    `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rand() * 360)}) scale(${f(size)})" opacity="${f(0.55 + rand() * 0.35)}">` +
    `<path d="${LEAF}" fill="${color}"/>` +
    `<path d="${RIB}" stroke="#2a1a0e" stroke-opacity="0.45" stroke-width="0.09" fill="none" stroke-linecap="round"/></g>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(
  `${OUT}/leaves.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>\n`,
);
console.log('wrote', OUT);
