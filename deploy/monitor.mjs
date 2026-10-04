#!/usr/bin/env node
// Samples the box's resource usage into a CSV until Ctrl+C, then prints min/avg/max.
// Run on the box:  sudo node ~/wall-calendar/deploy/monitor.mjs [intervalSeconds] [out.csv]
// sudo lets it read Chrome's real memory (PSS); without it, it falls back to RSS (an overcount,
// since Chrome's processes share memory).
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { cpus, homedir } from 'node:os';

const interval = Number(process.argv[2] ?? 2) * 1000;
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
// Under sudo, still write to the real user's home rather than /root.
const home = process.env.SUDO_USER ? `/home/${process.env.SUDO_USER}` : homedir();
const out = process.argv[3] ?? `${home}/monitor-${stamp}.csv`;

const read = (p) => {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
};
const kb = (text, field) => Number(new RegExp(`^${field}:\\s+(\\d+)`, 'm').exec(text)?.[1] ?? 0);

/** Process groups worth watching, by the process name the kernel reports. */
const GROUPS = { chrome: /^chrome/, node: /^node$/, cage: /^cage$/ };

function totalJiffies() {
  const f = read('/proc/stat').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
  return { total: f.reduce((a, b) => a + b, 0), idle: f[3] + f[4] };
}

let usedPss = false;
function groupStats() {
  const stats = Object.fromEntries(
    Object.keys(GROUPS).map((g) => [g, { jiffies: 0, memKb: 0, procs: 0 }]),
  );
  for (const pid of readdirSync('/proc').filter((d) => /^\d+$/.test(d))) {
    const comm = read(`/proc/${pid}/comm`).trim();
    const group = Object.keys(GROUPS).find((g) => GROUPS[g].test(comm));
    if (!group) continue;
    // Fields after the ")" that ends the name: utime and stime are the 12th and 13th.
    const stat = read(`/proc/${pid}/stat`);
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const pss = kb(read(`/proc/${pid}/smaps_rollup`), 'Pss');
    if (pss) usedPss = true;
    const s = stats[group];
    s.jiffies += Number(fields[11] ?? 0) + Number(fields[12] ?? 0);
    s.memKb += pss || kb(read(`/proc/${pid}/status`), 'VmRSS');
    s.procs++;
  }
  return stats;
}

function tempC() {
  let max = 0;
  for (const z of readdirSync('/sys/class/thermal').filter((d) => d.startsWith('thermal_zone'))) {
    max = Math.max(max, Number(read(`/sys/class/thermal/${z}/temp`)) / 1000 || 0);
  }
  return max;
}

const COLUMNS = [
  'cpu_pct',
  'mem_used_mb',
  'load1',
  'temp_c',
  'chrome_cpu_pct',
  'chrome_mem_mb',
  'chrome_procs',
  'node_cpu_pct',
  'node_mem_mb',
  'cage_cpu_pct',
];
writeFileSync(out, `time,${COLUMNS.join(',')}\n`);
const rows = [];

let prevCpu = totalJiffies();
let prevGroups = groupStats();
console.log(
  `Sampling every ${interval / 1000}s into ${out} (${cpus().length} CPUs). Ctrl+C to stop.`,
);
console.log('cpu% = share of the whole machine (all cores).');

const timer = setInterval(() => {
  const cpu = totalJiffies();
  const groups = groupStats();
  const dTotal = cpu.total - prevCpu.total || 1;
  const pct = (j) => (100 * j) / dTotal;
  const mem = read('/proc/meminfo');
  const row = {
    cpu_pct: pct(dTotal - (cpu.idle - prevCpu.idle)),
    mem_used_mb: (kb(mem, 'MemTotal') - kb(mem, 'MemAvailable')) / 1024,
    load1: Number(read('/proc/loadavg').split(' ')[0]),
    temp_c: tempC(),
    chrome_cpu_pct: pct(groups.chrome.jiffies - prevGroups.chrome.jiffies),
    chrome_mem_mb: groups.chrome.memKb / 1024,
    chrome_procs: groups.chrome.procs,
    node_cpu_pct: pct(groups.node.jiffies - prevGroups.node.jiffies),
    node_mem_mb: groups.node.memKb / 1024,
    cage_cpu_pct: pct(groups.cage.jiffies - prevGroups.cage.jiffies),
  };
  // A Chrome process exiting between samples can make its group's delta negative.
  for (const k of Object.keys(row)) row[k] = Math.max(0, row[k]);
  prevCpu = cpu;
  prevGroups = groups;
  rows.push(row);
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  appendFileSync(out, `${time},${COLUMNS.map((c) => row[c].toFixed(1)).join(',')}\n`);
  console.log(
    `${time}  cpu ${row.cpu_pct.toFixed(0).padStart(3)}%  mem ${row.mem_used_mb.toFixed(0)}MB  ` +
      `${row.temp_c.toFixed(0)}°C  | chrome ${row.chrome_cpu_pct.toFixed(0).padStart(3)}% ` +
      `${row.chrome_mem_mb.toFixed(0)}MB  | node ${row.node_cpu_pct.toFixed(0).padStart(3)}% ` +
      `${row.node_mem_mb.toFixed(0)}MB`,
  );
}, interval);

process.on('SIGINT', () => {
  clearInterval(timer);
  if (!rows.length) process.exit(0);
  console.log(
    `\n${rows.length} samples. Chrome memory is ${usedPss ? 'PSS (accurate)' : 'RSS (overcounts; run with sudo for PSS)'}.`,
  );
  console.log('column'.padEnd(16) + 'min'.padStart(9) + 'avg'.padStart(9) + 'max'.padStart(9));
  for (const c of COLUMNS) {
    const v = rows.map((r) => r[c]);
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    console.log(
      c.padEnd(16) +
        [Math.min(...v), avg, Math.max(...v)].map((n) => n.toFixed(1).padStart(9)).join(''),
    );
  }
  console.log(`\nCSV: ${out}`);
  process.exit(0);
});
