// Generates the Cinco de Mayo nav tile (strings of papel picado) into public/themes/cinco:
// node scripts/cinco-papel-picado.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/themes/cinco', import.meta.url));
const W = 130; // Matches the nav's width (6.5rem), so each string spans it once.
const H = 190; // Two strings per tile; the tile repeats down the nav.
const STRINGS = [28, 123]; // y of each string's ends
const FLAGS = 4;
const FLAG_W = 25;
const FLAG_H = 32;
const SAG = 9;
const COLORS = ['#ff4f8b', '#ffb000', '#21c7b8', '#9be15d', '#a970ff', '#ff7a1a'];

const f = (n) => n.toFixed(1);
const circle = (cx, cy, r) =>
  `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const diamond = (cx, cy, r) =>
  `M${f(cx)} ${f(cy - r)}L${f(cx + r)} ${f(cy)}L${f(cx)} ${f(cy + r)}L${f(cx - r)} ${f(cy)}Z`;

/** One flag hanging from (x, y): zigzag bottom, with cut-outs made by evenodd holes. */
function flag(x, y) {
  const l = x - FLAG_W / 2;
  const r = x + FLAG_W / 2;
  const b = y + FLAG_H;
  let d = `M${f(l)} ${f(y)}L${f(r)} ${f(y)}L${f(r)} ${f(b)}`;
  const teeth = 5;
  for (let i = 1; i <= teeth; i++) {
    const tx = r - (FLAG_W * i) / teeth;
    d += `L${f(tx + FLAG_W / teeth / 2)} ${f(b - 4)}L${f(tx)} ${f(b)}`;
  }
  d += 'Z';
  // The cut pattern: a center diamond ringed by little circles.
  const cy = y + FLAG_H * 0.45;
  d += diamond(x, cy, 4.2);
  for (const [dx, dy] of [
    [-7, -7],
    [7, -7],
    [-7, 7],
    [7, 7],
  ]) {
    d += circle(x + dx, cy + dy, 1.6);
  }
  d += circle(x, y + 5, 1.4);
  return d;
}

let body = '';
let c = 0;
for (const sy of STRINGS) {
  // The string sags in the middle.
  const yAt = (x) => sy + SAG * 4 * (x / W) * (1 - x / W);
  body += `<path d="M0 ${f(sy)}Q${W / 2} ${f(sy + SAG * 2)} ${W} ${f(sy)}" stroke="#f3e6d0" stroke-opacity="0.7" stroke-width="1.2" fill="none"/>`;
  for (let i = 0; i < FLAGS; i++) {
    const x = ((i + 0.5) * W) / FLAGS;
    body += `<path d="${flag(x, yAt(x))}" fill="${COLORS[c++ % COLORS.length]}" fill-rule="evenodd" fill-opacity="0.92"/>`;
  }
}

mkdirSync(OUT, { recursive: true });
writeFileSync(
  `${OUT}/papel-picado.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>\n`,
);
console.log('wrote', OUT);
