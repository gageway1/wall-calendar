// Generates the Halloween nav cobwebs into public/themes/halloween: node scripts/halloween-webs.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/themes/halloween', import.meta.url));
const STROKE = 'stroke="#f5ecdf" stroke-opacity="0.32" fill="none" stroke-linecap="round"';

// Deterministic jitter so the web looks hand-spun but never changes between runs.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const f = (n) => n.toFixed(1);

/**
 * A fan web: threads from (cx, cy) between two angles (degrees, SVG coords), joined by rings
 * that sag toward the center like real silk.
 */
function web(cx, cy, fromDeg, toDeg, threads, radii, reach) {
  const angles = Array.from({ length: threads }, (_, i) => {
    const a = fromDeg + ((toDeg - fromDeg) * i) / (threads - 1);
    return ((a + rand() * 3) * Math.PI) / 180;
  });
  const pt = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  let d = '';
  for (const a of angles) {
    const [x, y] = pt(a, reach);
    d += `M${f(cx)} ${f(cy)}L${f(x)} ${f(y)}`;
  }
  for (const r0 of radii) {
    const rs = angles.map(() => r0 * (1 + rand() * 0.06));
    for (let i = 0; i < angles.length - 1; i++) {
      const [x1, y1] = pt(angles[i], rs[i]);
      const [x2, y2] = pt(angles[i + 1], rs[i + 1]);
      const mid = (angles[i] + angles[i + 1]) / 2;
      const [qx, qy] = pt(mid, ((rs[i] + rs[i + 1]) / 2) * 0.84);
      d += `M${f(x1)} ${f(y1)}Q${f(qx)} ${f(qy)} ${f(x2)} ${f(y2)}`;
    }
  }
  return d;
}

function spider(x, y) {
  const legs = [-1, 1]
    .flatMap((s) =>
      [
        [8, -9, 15, -14],
        [10, -3, 18, -4],
        [10, 3, 17, 9],
        [8, 8, 13, 17],
      ].map(([kx, ky, fx, fy]) => `M${x} ${y}Q${x + s * kx} ${y + ky - 4} ${x + s * fx} ${y + fy}`),
    )
    .join('');
  return `
  <path d="${legs}" stroke="#0b0610" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <ellipse cx="${x}" cy="${y + 2}" rx="6.5" ry="8" fill="#0b0610"/>
  <circle cx="${x}" cy="${y - 7}" r="4.2" fill="#0b0610"/>
  <circle cx="${x - 1.6}" cy="${y - 7.6}" r="1.1" fill="#ff7a1a"/>
  <circle cx="${x + 1.6}" cy="${y - 7.6}" r="1.1" fill="#ff7a1a"/>`;
}

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}\n</svg>\n`;

mkdirSync(OUT, { recursive: true });

// Top-left corner web.
writeFileSync(
  `${OUT}/web-corner.svg`,
  svg(
    200,
    200,
    `\n  <path d="${web(0, 0, 4, 86, 8, [20, 42, 66, 92, 120, 150], 162)}" ${STROKE} stroke-width="1.3"/>`,
  ),
);

// Side web on the nav's right edge, with a spider dangling from it.
const anchor = [120, 60];
writeFileSync(
  `${OUT}/web-side.svg`,
  svg(
    120,
    210,
    `\n  <path d="${web(...anchor, 100, 250, 7, [14, 30, 48, 68, 90], 97)}" ${STROKE} stroke-width="1.2"/>
  <path d="M84 72L84 170" stroke="#f5ecdf" stroke-opacity="0.45" stroke-width="1"/>${spider(84, 180)}`,
  ),
);
console.log('wrote', OUT);
