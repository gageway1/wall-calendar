// Drives the kiosk's real Chrome through a fixed loop of taps and records its memory each lap,
// so leaks and slowdowns show up over hours. Needs the ssh tunnel to the debugging port:
//   ssh -N -L 9222:localhost:9222 wall        (leave running)
//   node loadtest/soak.mjs [--minutes 30] [--pace 400] [--pin 1234] [--chores]
//
// Safe by design: never saves events or anything that reaches Google. --pin adds theme switching
// through Settings (put back at the end); --chores taps the first chore twice per lap (net no
// change). Ctrl+C stops after the current step and still restores.
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const MINUTES = Number(opt('minutes', 30));
const PACE = Number(opt('pace', 400)); // ms between taps
const PIN = opt('pin', null);
const CHORES = args.includes('--chores');

const browser = await puppeteer.connect({
  browserURL: 'http://localhost:9222',
  defaultViewport: null,
});
const page = (await browser.pages()).find((p) => p.url().includes(':4000'));
if (!page) throw new Error('No wall page found. Is the tunnel up and the kiosk running?');
const origin = new URL(page.url()).origin;

let stopping = false;
process.on('SIGINT', () => {
  if (stopping) process.exit(1);
  stopping = true;
  console.log('\nStopping after this step (Ctrl+C again to quit without restoring)...');
});

const wait = (ms = PACE) => new Promise((r) => setTimeout(r, ms));

/** Taps the element's center with a real touch event, like a finger on the panel. */
async function tap(selector, { text, index = 0 } = {}) {
  let els = await page.$$(selector);
  if (text) {
    const texts = await Promise.all(els.map((e) => e.evaluate((n) => n.textContent.trim())));
    els = els.filter((_, i) => texts[i] === text);
  }
  const el = els[index];
  if (!el) return false;
  const box = await el.boundingBox();
  if (!box) return false;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await wait();
  return true;
}

const go = (label) => tap('.rail-item', { text: label });

async function unlockSettings() {
  await go('Settings');
  if (await page.$('app-pin-pad .key')) {
    for (const d of PIN) await tap('app-pin-pad .key', { text: d });
    await tap('app-pin-pad .ok');
    await wait(600);
  }
  return !!(await page.$('.theme-tile'));
}

// --- Theme bookkeeping (only with --pin) ---------------------------------------------------
const themeInfo = PIN ? await (await fetch(`${origin}/api/config/theme`)).json() : null;
const originalTile = themeInfo
  ? themeInfo.selected === 'auto'
    ? 'Automatic'
    : themeInfo.themes.find((t) => t.id === themeInfo.selected)?.name
  : null;
const themeNames = themeInfo ? themeInfo.themes.map((t) => t.name) : [];

// --- Results -----------------------------------------------------------------------------------
const resultsDir = fileURLToPath(new URL('./results/', import.meta.url));
mkdirSync(resultsDir, { recursive: true });
const csv = `${resultsDir}soak-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.csv`;
writeFileSync(
  csv,
  'lap,minutes,lap_seconds,js_heap_mb,dom_nodes,listeners,layouts,style_recalcs\n',
);

const cdp = await page.createCDPSession();
async function sample(lap, lapSeconds, startedAt) {
  // Collect garbage first so the heap number reflects what's actually retained (leaks), not
  // whatever happened to be lying around.
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
  const m = await page.metrics();
  const row = [
    lap,
    ((Date.now() - startedAt) / 60000).toFixed(1),
    lapSeconds.toFixed(1),
    (m.JSHeapUsedSize / 1048576).toFixed(1),
    m.Nodes,
    m.JSEventListeners,
    m.LayoutCount,
    m.RecalcStyleCount,
  ];
  appendFileSync(csv, row.join(',') + '\n');
  console.log(
    `lap ${String(lap).padStart(4)}  ${row[1].padStart(5)}min  ${row[2]}s/lap  heap ${row[3]}MB  ` +
      `nodes ${m.Nodes}  listeners ${m.JSEventListeners}`,
  );
}

// --- The loop ----------------------------------------------------------------------------------
/** One lap: every screen, paging, a dialog, the timer, and optionally chores and a theme. */
async function lap(n) {
  const steps = [
    () => go('Home'),
    () => go('Week'),
    () => tap('.icon-btn[aria-label="Next week"]'),
    () => tap('.icon-btn[aria-label="Next week"]'),
    () => tap('.icon-btn[aria-label="Previous week"]'),
    () => tap('.icon-btn[aria-label="Previous week"]'),
    () => go('Month'),
    () => tap('.icon-btn[aria-label="Next month"]'),
    () => tap('.icon-btn[aria-label="Previous month"]'),
    // Open a day (read-only list) and close it with its X. Never taps inside the dialog.
    async () => (await tap('app-month .cell .num', { index: 10 })) && tap('app-dialog .close'),
    () => go('Chores'),
    ...(CHORES
      ? [() => tap('app-chores .check:not(.off)'), () => tap('app-chores .check:not(.off)')]
      : []),
    () => go('Meals'),
    () => go('Lists'),
    // Timer: open, start the shortest preset, stop, hide.
    () => tap('.tool[aria-label="Timer"]'),
    () => tap('app-timer .preset'),
    () => tap('app-timer .btn.danger', { text: 'Stop' }),
    () => tap('app-timer .close'),
    ...(PIN && themeNames.length
      ? [
          async () => {
            if (await unlockSettings())
              await tap('.theme-tile .theme-name', { text: themeNames[n % themeNames.length] });
          },
        ]
      : []),
  ];
  for (const step of steps) {
    if (stopping) return;
    await step();
  }
}

console.log(
  `Soaking for ${MINUTES} min at ${PACE}ms per tap${PIN ? ', switching themes' : ''}${CHORES ? ', toggling a chore' : ''}.`,
);
console.log(`Results: ${csv}\n`);
const startedAt = Date.now();
const until = startedAt + MINUTES * 60000;
await sample(0, 0, startedAt);
try {
  for (let n = 1; Date.now() < until && !stopping; n++) {
    const t0 = Date.now();
    await lap(n);
    if (!stopping) await sample(n, (Date.now() - t0) / 1000, startedAt);
  }
} finally {
  // Put the screen back the way we found it.
  if (originalTile && (await unlockSettings())) {
    await tap('.theme-tile .theme-name', { text: originalTile });
    console.log(`Theme restored to ${originalTile}.`);
  }
  await go('Home');
  await browser.disconnect();
  console.log(`\nDone. CSV: ${csv}`);
}
