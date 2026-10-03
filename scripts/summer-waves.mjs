// Generates the Summer nav wave tile into public/themes/summer: node scripts/summer-waves.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/themes/summer', import.meta.url));
const W = 130; // The nav's width (6.5rem); two full wavelengths so the repeat is seamless.
const H = 64; // Two wave rows, offset half a wavelength.
const WAVELENGTH = W / 2;
const AMPLITUDE = 4;

const f = (n) => n.toFixed(1);

/** A smooth sine-ish wave across the tile at height y, built from quadratic curves. */
function wave(y, phase) {
  const q = WAVELENGTH / 4;
  let d = `M${f(-phase)} ${f(y)}`;
  for (let x = -phase; x < W + WAVELENGTH; x += WAVELENGTH) {
    d += `Q${f(x + q)} ${f(y - AMPLITUDE)} ${f(x + 2 * q)} ${f(y)}`;
    d += `Q${f(x + 3 * q)} ${f(y + AMPLITUDE)} ${f(x + 4 * q)} ${f(y)}`;
  }
  return d;
}

const body =
  `<path d="${wave(16, 0)}" stroke-opacity="0.4"/>` +
  `<path d="${wave(48, WAVELENGTH / 2)}" stroke-opacity="0.25"/>`;

mkdirSync(OUT, { recursive: true });
writeFileSync(
  `${OUT}/waves.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<g stroke="#cdeeff" stroke-width="2" stroke-linecap="round" fill="none">${body}</g></svg>\n`,
);
console.log('wrote', OUT);
