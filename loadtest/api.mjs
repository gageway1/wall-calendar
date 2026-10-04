// Hammers the wall's read-only API endpoints and reports throughput and latency.
// Never calls anything that reaches Google (google/*, lists) or writes.
//   node loadtest/api.mjs [--base http://wall:4000] [--concurrency 20] [--seconds 30]
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .flatMap((a, i, all) => (a.startsWith('--') ? [[a.slice(2), all[i + 1]]] : [])),
);
const BASE = args.base ?? 'http://wall:4000';
const CONCURRENCY = Number(args.concurrency ?? 20);
const SECONDS = Number(args.seconds ?? 30);

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
};
const ENDPOINTS = [
  '/api/health',
  `/api/events?from=${day(0)}&to=${day(1)}`,
  `/api/events?from=${day(-3)}&to=${day(4)}`,
  `/api/events?from=${day(-7)}&to=${day(35)}`,
  `/api/chores/day?day=${day(0)}`,
  '/api/chores',
  '/api/people',
  `/api/meals?from=${day(-3)}&to=${day(4)}`,
  `/api/lunch?from=${day(0)}&to=${day(7)}`,
  '/api/weather', // Cached server-side for 10 minutes, so this won't hammer Open-Meteo.
  '/api/config/theme',
  '/api/config/sleep',
];

const results = []; // [endpoint, ms, status]
const deadline = Date.now() + SECONDS * 1000;
let next = 0;

async function worker() {
  while (Date.now() < deadline) {
    const path = ENDPOINTS[next++ % ENDPOINTS.length];
    const t0 = performance.now();
    let status;
    try {
      const res = await fetch(BASE + path);
      await res.arrayBuffer();
      status = res.status;
    } catch {
      status = 'network error';
    }
    results.push([path.split('?')[0], performance.now() - t0, status]);
  }
}

console.log(`${CONCURRENCY} concurrent clients for ${SECONDS}s against ${BASE}...`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const pct = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
const summarize = (rows) => {
  const ms = rows.map((r) => r[1]).sort((a, b) => a - b);
  return [ms.length, pct(ms, 50), pct(ms, 95), pct(ms, 99), ms.at(-1)];
};

const [n, p50, p95, p99, max] = summarize(results);
console.log(`\n${n} requests, ${(n / SECONDS).toFixed(0)} req/s`);
console.log(
  `latency ms  p50 ${p50.toFixed(1)}  p95 ${p95.toFixed(1)}  p99 ${p99.toFixed(1)}  max ${max.toFixed(1)}`,
);

const bad = results.filter((r) => r[2] !== 200);
const byStatus = Object.groupBy(bad, (r) => `${r[0]} → ${r[2]}`);
if (bad.length) {
  console.log(`\n${bad.length} failed:`);
  for (const [k, v] of Object.entries(byStatus)) console.log(`  ${k}: ${v.length}`);
}

console.log(
  '\nper endpoint'.padEnd(22) +
    'n'.padStart(7) +
    'p50'.padStart(8) +
    'p95'.padStart(8) +
    'max'.padStart(8),
);
for (const [path, rows] of Object.entries(Object.groupBy(results, (r) => r[0]))) {
  const [c, e50, e95, , emax] = summarize(rows);
  console.log(
    path.padEnd(21) +
      String(c).padStart(7) +
      [e50, e95, emax].map((v) => v.toFixed(1).padStart(8)).join(''),
  );
}
