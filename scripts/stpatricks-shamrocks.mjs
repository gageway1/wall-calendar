// Generates the St. Patrick's nav shamrock tile into public/themes/stpatricks:
// node scripts/stpatricks-shamrocks.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/themes/stpatricks', import.meta.url));
const W = 130; // Tile size (px in the SVG; scaled by the CSS background-size).
const H = 170;
const SHAMROCKS = 7;
const COLORS = ['#c9f2c7', '#8fdc8f', '#e8f7d9'];

// Deterministic jitter so the pattern never changes between runs.
let seed = 17;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const f = (n) => n.toFixed(1);

// A heart-shaped leaf pointing up from 0,0 (its tip at the center), about 1 unit long.
const LEAF =
  'M0 0C-0.9 -0.5 -0.75 -1.15 -0.3 -1.15C-0.1 -1.15 0 -1 0 -0.88C0 -1 0.1 -1.15 0.3 -1.15C0.75 -1.15 0.9 -0.5 0 0Z';
const shamrock = [0, 120, 240].map((a) => `<path d="${LEAF}" transform="rotate(${a})"/>`).join('');
const stem = (color) =>
  `<path d="M0 0.1Q0.25 0.7 0.6 1.1" fill="none" stroke="${color}" stroke-width="0.16" stroke-linecap="round"/>`;

let body = '';
for (let i = 0; i < SHAMROCKS; i++) {
  const size = 5 + rand() * 6;
  // Keep shamrocks off the tile edges so the repeat has no seams.
  const m = size * 1.6;
  const x = m + rand() * (W - 2 * m);
  const y = m + rand() * (H - 2 * m);
  const color = COLORS[Math.floor(rand() * COLORS.length)];
  body += `<g fill="${color}" opacity="${f(0.3 + rand() * 0.35)}" transform="translate(${f(x)} ${f(y)}) rotate(${f(rand() * 360)}) scale(${f(size)})">${shamrock}${stem(color)}</g>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(
  `${OUT}/shamrocks.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>\n`,
);
console.log('wrote', OUT);
