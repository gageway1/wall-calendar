// Generates the 4th of July nav canton stars into public/themes/july: node scripts/july-stars.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/themes/july', import.meta.url));
const W = 130; // Sized by the CSS to 6.5rem x 18rem (the canton), so keep this 130:360.
const H = 360;
const ROWS = 11; // Alternating rows of 4 and 3, staggered like the flag.
const R = 7; // Star outer radius.

const f = (n) => n.toFixed(1);

function star(cx, cy) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * 0.4 : R;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`;
  }
  return d + 'Z';
}

let d = '';
const rowGap = H / (ROWS + 1);
for (let row = 0; row < ROWS; row++) {
  const y = rowGap * (row + 1);
  const n = row % 2 ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const x = row % 2 ? (W / 4) * (i + 1) : (W / 4) * (i + 0.5);
    d += star(x, y);
  }
}

mkdirSync(OUT, { recursive: true });
writeFileSync(
  `${OUT}/stars.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="${d}" fill="#f5f1e8" fill-opacity="0.9"/></svg>\n`,
);
console.log('wrote', OUT);
