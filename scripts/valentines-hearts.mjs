// Generates the Valentine's nav hearts tile into public/themes/valentines:
// node scripts/valentines-hearts.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/themes/valentines', import.meta.url));
const W = 130; // Tile size (px in the SVG; scaled by the CSS background-size).
const H = 170;
const HEARTS = 9;
const COLORS = ['#ffffff', '#ffd6e6', '#ffb3cf'];

// Deterministic jitter so the pattern never changes between runs.
let seed = 14;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const f = (n) => n.toFixed(1);

// A unit heart centered on 0,0, about 2 units wide.
const HEART =
  'M0 0.7C-1.2 -0.1 -1.1 -1 -0.5 -1C-0.2 -1 0 -0.8 0 -0.6C0 -0.8 0.2 -1 0.5 -1C1.1 -1 1.2 -0.1 0 0.7Z';

let body = '';
for (let i = 0; i < HEARTS; i++) {
  const size = 4 + rand() * 7;
  // Keep hearts off the tile edges so the repeat has no seams.
  const m = size * 1.3;
  const x = m + rand() * (W - 2 * m);
  const y = m + rand() * (H - 2 * m);
  const tilt = (rand() - 0.5) * 50;
  const color = COLORS[Math.floor(rand() * COLORS.length)];
  body += `<path d="${HEART}" fill="${color}" fill-opacity="${f(0.35 + rand() * 0.4)}" transform="translate(${f(x)} ${f(y)}) rotate(${f(tilt)}) scale(${f(size)})"/>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(
  `${OUT}/hearts.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>\n`,
);
console.log('wrote', OUT);
