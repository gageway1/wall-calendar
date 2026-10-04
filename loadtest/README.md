# Load testing the wall box

Three tools:

- **`deploy/monitor.mjs`** runs on the box and records CPU, memory, load, temperature, and
  Chrome/Node usage to a CSV. Ctrl+C prints min/avg/max for each column.
- **`loadtest/api.mjs`** runs on the PC and hammers the read-only API.
- **`loadtest/soak.mjs`** runs on the PC and drives the kiosk's real Chrome through a fixed tap
  loop, recording Chrome's memory each lap.

Always measure the **idle baseline first**, so you have something to compare the load runs to.

## 0. One-time setup

```powershell
cd loadtest; npm i; cd ..
# The kiosk needs its debugging port (localhost only), so commit, deploy, then re-run setup:
git add -A; git commit -m "Load test tools"
npm run deploy
ssh -t wall "cd ~/wall-calendar && sudo ./deploy/setup.sh"
```

## 1. Baseline: the wall sitting idle

Leave the wall alone on Home: no taps, no tests. During the day, check that night mode isn't on.

```powershell
ssh -t wall "sudo node ~/wall-calendar/deploy/monitor.mjs 2 ~/baseline-idle.csv"
```

Let it run **10 minutes** and don't touch the screen, then press Ctrl+C. Write down the summary.
The numbers to note:

| column | meaning |
|---|---|
| `cpu_pct` | whole-machine CPU, 0–100 across all cores |
| `mem_used_mb` | RAM in use (excluding cache) |
| `temp_c` | hottest thermal sensor |
| `chrome_cpu_pct` / `chrome_mem_mb` | the kiosk browser (all its processes) |
| `node_cpu_pct` / `node_mem_mb` | the app server |

The night screen is a separate case worth one more baseline (its drifting clock is the only
thing moving at night). Run the same command after 10pm into `~/baseline-night.csv`.

## 2. API load

Monitor in one window (`...monitor.mjs 2 ~/api-load.csv`), then in another:

```powershell
node loadtest/api.mjs --seconds 60 --concurrency 20
```

Then try `--concurrency 100` for the worst case. Realistically it's one screen plus a couple of
phones, so even 20 is far beyond real use.

## 3. UI soak (the real worst case)

```powershell
ssh -N -L 9222:localhost:9222 wall          # window 1: tunnel to the kiosk's Chrome; leave running
ssh -t wall "sudo node ~/wall-calendar/deploy/monitor.mjs 5 ~/soak.csv"   # window 2
node loadtest/soak.mjs --minutes 30 --pin <parent PIN>                    # window 3
```

You'll see the wall flip through every screen by itself. Options:

- `--pace 200` taps faster (default 400ms per tap).
- `--chores` also taps the first chore on and off each lap (net no change).
- `--pin` adds theme switching through Settings. Leave it out to skip themes.
- Ctrl+C stops cleanly and puts the theme back.

Run it for hours (`--minutes 240`) to look for leaks. In `loadtest/results/soak-*.csv`, watch
`js_heap_mb` and `dom_nodes`. They should level off; a steady climb lap after lap is a leak.

## Reading the results

- **Compare against the baseline.** Idle CPU should be near zero; under soak, watch whether
  `temp_c` keeps climbing (a small box in a wall bracket can heat-soak) or levels off.
- **`chrome_mem_mb`** should rise during the soak and then plateau.
- **Copy the CSVs off the box** with `scp wall:~/*.csv loadtest/results/` to open them in a
  spreadsheet.
