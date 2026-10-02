# Wall Calendar — project notes for Claude

A self-hosted family wall calendar (a DIY Skylight replacement) for one household. It runs on a
spare **Dell OptiPlex 5050 Micro** driving an **AOC 15.6" 1920×1080 touch monitor**, with Chromium
in kiosk mode. There is one screen, one family, and no phone layout: phones use the Google
Calendar and Google Tasks apps.

## People and preferences

- The user is **Gage**, an Angular developer who is happy to vibe-code. Keep replies terse and
  practical, and verify things in a real browser before saying they're done.
- The household is Gage, Alexis (both have Google calendars), and the kids **Skylar (10)** and
  **August (5)**. The kids are *wall-only* people with no accounts and no sign-in; they just tap
  their chores off.
- Location is Greenwood, Indiana (America/Indiana/Indianapolis). Skylar attends Southwest
  Elementary (Greenwood Community Schools).
- **Never show developer wording in the UI.** Errors read "Oops! Something went wrong."; the
  details go to the logs.
- The parent PIN is a *kid-proof speed bump*, not security. Don't over-engineer auth.
- The target is **exactly 1920×1080 on a 15.6" panel (~141 PPI)**. Keep touch targets at
  ~2.6rem (~9mm) or bigger, and don't build phone/responsive layouts.
  **1478×831 in DevTools on the user's desktop monitor is exactly 15.6" physically**; use it for
  size checks and screenshots alongside 1920×1080.

## Stack and layout

- **Angular 22** (signals, standalone, zoneless-style) built with the SSR template, used only for
  its Express server. Every route is `RenderMode.Client`, so there is no hydration.
- **One Node 24 process**: Express serves `/api/*` plus the SPA. It uses SQLite via the built-in
  `node:sqlite`.
- `src/app/`: UI. `core/` has services and helpers, `shared/` has reusable components (OSK,
  dialogs, toasts, PIN pad, timer, sleep screen…), and there is one folder per screen (home,
  week, month, chores, meals, lists, settings, quick-add).
- `src/server/`: `api.ts` is the router plus error mapping. `db.ts` holds the append-only
  migrations (6 so far; never edit a shipped one). Also `google/` (OAuth, Calendar, Tasks,
  sync), `lunch/` (school menus), `chores/logic.ts` (pure schedule and streak rules), `routes/`,
  `logger.ts`, and `pin.ts`.
- `data/` is gitignored and holds `wall.db` plus `logs/wall-YYYY-MM-DD.log` (JSON lines, kept
  14 days).
- Config lives in `.env` (gitignored; see `.env.example`): `PORT`, `DATA_DIR`, `WALL_LAT`,
  `WALL_LON`, `WALL_LOCATION_NAME`, `WALL_UNITS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `SCHOOL_LUNCH_URL`, and optionally `LOG_DIR`. `server.ts` calls `process.loadEnvFile()`.

## Commands

```sh
npm start            # dev, http://localhost:4200 (Express /api runs inside ng serve)
npm test             # vitest via `ng test --watch=false` (68 tests)
npm run build        # -> dist/wall-calendar
npm run serve:prod   # node dist/wall-calendar/server/server.mjs (PORT, default 4000)
```

## Gotchas (learned the hard way)

- `node:sqlite` is loaded through `process.getBuiltinModule('node:sqlite')`, because esbuild
  rewrites the `node:` import into a bare `sqlite` that doesn't exist.
- `ng build` **imports the server and pre-boots the app** to extract routes. So the DB opens
  lazily, background loops (calendar sync, lunch sync) start on the first API request, and
  root services must guard `window` with `isPlatformBrowser`.
- `security.allowedHosts: ["*"]` in angular.json lets LAN/Tailscale hosts reach the app. It's
  fine because nothing renders on the server, but never expose it to the internet.
- **Ghost clicks:** anything that *closes* an overlay must act on `click`, not `pointerdown`
  (the OSK Done key had this bug). The other OSK keys use pointerdown with preventDefault.
- Popups focus their text field on open (`viewChild` plus an effect), so Enter saves instead of
  re-clicking the button that opened them.
- HTTP errors are handled by `core/error-reporting.ts`. Failed writes show an error toast and
  are logged; failed background GETs show a single deduped "can't reach" warning; 409
  `google_scope_missing` / `google_api_disabled` are explained on the page itself. The global
  ErrorHandler ignores `HttpErrorResponse`.
- Server network failures (`networkErrorCode`) become 503 plus a one-line warning, never a 500
  with a stack. Sync logs when an outage starts and when it ends, not every attempt.
- The long-press context menu is blocked for touch and pen only (`App.blockTouchMenu`); mouse
  right-click still works for Inspect.
- **Touch panel on the box:** the AOC is an ILITEK `222a:0001` (hid-multitouch, works out of the box).
  Touch only works if cage starts *after* the panel is connected, and the panel's fake "Mouse"
  interface makes cage show a cursor. `deploy/99-wall-touch.rules` handles both. The box is
  reachable as `ssh wall` (key auth; `sudo -n` only works for restarting the two services).
- **Windows shell:** heredocs mangle `\n` and backslashes in inline Python/JS. Write scripts to
  files instead. Run `npx prettier --write` after edits.
- The school's dining *page* is behind a Fastly "Client Challenge" (bot check). Use the
  **Thrillshare menus API** instead:
  `https://thrillshare-cmsv2.services.thrillshare.com/api/v2/s/273117/menus?locale=en&query_id=49256`
  (it's paginated via `meta.links.next`). Don't spoof user-agents to get around the challenge.

## Verifying UI changes

- Unit tests: `npm test`.
- End to end: there's a throwaway puppeteer setup in `tmp/pp` (gitignored; `npm i
  puppeteer-core` there) that drives the installed Chrome
  (`C:/Program Files/Google/Chrome/Application/chrome.exe`). Run a demo server against seeded
  data with `PORT=4124 DATA_DIR=tmp/demo node dist/wall-calendar/server/server.mjs`. The demo
  PIN is 2468. Intercept Google-bound writes with request interception; never write to real
  Google from tests.
- Use real touch (`hasTouch` + `page.touchscreen.tap`) for anything gesture-related; mouse
  events don't reproduce ghost clicks.
- Screenshot at 1920×1080 and 1478×831, and look at them before claiming something works.

## Features (all built)

Home (clock, weather, today's agenda, chores card, 7-day strip, tonight's dinner and school
lunch), Week, Month, Chores (daily/weekdays/once with streaks), Meals (dinners plus automatic
school lunch), Lists (Google Tasks), Settings (People with calendar linking, chores on/off and
the PIN lock, Parent PIN, Night mode, School lunch, Guest Wi-Fi, keyboard mode, Diagnostics),
quick-add/edit/delete events from the wall, a built-in on-screen keyboard, toasts, a kids'
timer, a guest Wi-Fi QR code, night mode (10pm–6am dim drifting clock; tap to wake for 2 min),
a 1px pixel shift every 15 min, and a nightly self-reload at 3am (only when idle and only if
`/api/health` answers).

## Not yet verified live (needs the user's real Google account)

- Adding, editing and deleting events from the wall against real Google Calendar.
- Lists against real Google Tasks. This needs the **Google Tasks API** enabled, the
  `https://www.googleapis.com/auth/tasks` scope added under Data Access, and one disconnect and
  reconnect.
- One-time user steps: import `G:\downloads\GWS-2026-27-school-calendar.ics` into a "School"
  calendar in the household Google account, then link it in Settings → People. Set Settings →
  School lunch → Skylar.

## Next: deployment (M5)

### Hardware

- OptiPlex 5050 Micro (i5 7th gen; Gage has ~6). Pick the one with the most RAM (8GB+).
  It's physically bigger than expected but fine. It has HDMI 1.4 and DisplayPort out, USB-A
  ports, and **no USB-C**. It already has Ubuntu Server experience behind it.
- AOC 15.6" 1080p touch monitor. Inputs are **HDMI and 2× USB-C**, plus a built-in speaker.
  Power is **5V/3A (15W)**.
  - Video: HDMI from the OptiPlex.
  - Power: one USB-C port to a 15W+ USB-C charger (the OptiPlex's USB-A can't supply enough).
  - Touch: the other USB-C port to an OptiPlex USB-A port, using a **data-capable** A-to-C
    cable (many are charge-only). One of the C ports may be power-only; swap them if touch
    doesn't respond. Test the panel on a Windows PC first.
  - Audio: HDMI audio to the monitor speaker, for the timer chime.
- Mounting: a 3D-printed OptiPlex VESA bracket (PETG/ABS, not PLA; 4+ walls) screwed to the
  wall, **not** hung off the monitor's VESA mount. Keep the front and back vents clear.

### Box setup — implemented in `deploy/` (runbook: `deploy/README.md`; `sudo ./deploy/setup.sh`, `npm run deploy`). Uses the Google Chrome deb, not the Chromium snap. Original plan:

1. Ubuntu Server LTS with Node 24 (NodeSource or nvm system-wide). Set the timezone with
   `timedatectl set-timezone America/Indiana/Indianapolis`. Install `fonts-noto-color-emoji`
   (weather and other emoji), optionally Inter, and Tailscale (SSH from anywhere, plus phone
   access on the tailnet).
2. App: clone the repo, add `.env` (PORT=4000), run `npm ci && npm run build`. Create a
   `wall-calendar.service` with `Restart=always` and `After=network-online.target`. Logs then go
   to `journalctl -u wall-calendar`.
3. Kiosk: **cage** (single-app Wayland compositor) running Chromium, with autologin on tty1 or a
   systemd unit, restart on exit, and a wait for `/api/health` before launch. Chromium flags:
   `--kiosk --app=http://localhost:4000 --noerrdialogs --disable-session-crashed-bubble
   --disable-infobars --overscroll-history-navigation=0 --disable-pinch
   --autoplay-policy=no-user-gesture-required --disable-features=Translate`, plus a dedicated
   `--user-data-dir`. **Not incognito**, because localStorage holds per-screen settings.
4. Disable console blanking and DPMS idle (`consoleblank=0`); the app's night mode handles
   dimming. Then try real backlight control for night mode: `ddcutil` over DDC/CI (portable
   monitors often lack it), or `wlopm` to turn the output off. Check whether touch still wakes
   the panel when it's off.
5. Check that touch maps correctly (`libinput list-devices`). Set the HDMI audio sink as the
   default.
6. First Google sign-in on the box: from a PC run `ssh -L 4000:localhost:4000 <box>` (works
   over Tailscale) and open `http://localhost:4000/settings`. Google only accepts localhost
   redirect URIs.
7. Back up nightly with `sqlite3 data/wall.db ".backup …"` (cron/systemd timer). Deploys are
   git pull, then `npm ci && npm run build`, then `systemctl restart wall-calendar`; the 3am
   reload picks up anything missed.

### Open questions and small decisions

- The rail's "+" (add event) shows on every screen, including Chores and Meals. The user hasn't
  said whether to hide it there or make it context-aware.
- The school calendar is a one-time ICS import (the district only publishes a PDF). Lunch is
  automatic.
