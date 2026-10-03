// Generates the Winter nav snowfall tile into public/themes/winter: node scripts/winter-snow.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/themes/winter', import.meta.url));
const W = 130; // Tile size (px in the SVG; scaled by the CSS background-size).
const H = 170;
const DOTS = 26;
const FLAKES = 4;

// Deterministic jitter so the pattern never changes between runs.
let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const f = (n) => n.toFixed(1);
// Keep shapes off the tile edges so the repeat has no seams.
const at = (margin) => [margin + rand() * (W - 2 * margin), margin + rand() * (H - 2 * margin)];

let body = '';
for (let i = 0; i < DOTS; i++) {
  const [x, y] = at(4);
  body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1 + rand() * 1.8)}" fill-opacity="${f(0.45 + rand() * 0.45)}"/>`;
}
for (let i = 0; i < FLAKES; i++) {
  const [cx, cy] = at(12);
  const r = 5 + rand() * 4;
  const spin = rand() * Math.PI;
  let d = '';
  for (let k = 0; k < 6; k++) {
    const a = spin + (k * Math.PI) / 3;
    const [ex, ey] = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    d += `M${f(cx)} ${f(cy)}L${f(ex)} ${f(ey)}`;
    // Little side branches near each tip.
    for (const s of [-1, 1]) {
      const [bx, by] = [cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6];
      const b = a + s * 0.7;
      d += `M${f(bx)} ${f(by)}L${f(bx + Math.cos(b) * r * 0.35)} ${f(by + Math.sin(b) * r * 0.35)}`;
    }
  }
  body += `<path d="${d}" stroke="#fff" stroke-opacity="0.85" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(
  `${OUT}/snow.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g fill="#fff">${body}</g></svg>\n`,
);
console.log('wrote', OUT);
