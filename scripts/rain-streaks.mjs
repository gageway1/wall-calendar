// Generates the Rain nav tile into public/themes/rain: node scripts/rain-streaks.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/themes/rain', import.meta.url));
const W = 130; // Tile size (px in the SVG; scaled by the CSS background-size).
const H = 170;
const STREAKS = 30;
const DROPS = 5;
const SLANT = 0.28; // Horizontal drift per unit of fall, so the rain blows a little.

// Deterministic jitter so the pattern never changes between runs.
let seed = 23;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const f = (n) => n.toFixed(1);

let body = '';
for (let i = 0; i < STREAKS; i++) {
  const len = 8 + rand() * 18;
  // Keep streaks off the tile edges so the repeat has no seams.
  const x = 4 + rand() * (W - 8 - len * SLANT);
  const y = 4 + rand() * (H - 8 - len);
  body += `<path d="M${f(x)} ${f(y)}l${f(len * SLANT)} ${f(len)}" stroke-opacity="${f(0.25 + rand() * 0.4)}" stroke-width="${f(0.8 + rand() * 0.8)}"/>`;
}
// A few fat drops.
const DROP = 'M0 -1C0.35 -0.4 0.6 0 0.6 0.3A0.6 0.6 0 0 1 -0.6 0.3C-0.6 0 -0.35 -0.4 0 -1Z';
let drops = '';
for (let i = 0; i < DROPS; i++) {
  const s = 3 + rand() * 2.5;
  const x = 8 + rand() * (W - 16);
  const y = 8 + rand() * (H - 16);
  drops += `<path d="${DROP}" fill-opacity="${f(0.35 + rand() * 0.3)}" transform="translate(${f(x)} ${f(y)}) scale(${f(s)})"/>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(
  `${OUT}/rain.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<g stroke="#cfe4f7" stroke-linecap="round" fill="none">${body}</g><g fill="#cfe4f7">${drops}</g></svg>\n`,
);
console.log('wrote', OUT);
