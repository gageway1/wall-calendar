# Wall Calendar

A self-hosted family wall calendar: an Angular app plus a small Express API and SQLite, running as a
single Node process on a mini PC with a touch monitor. It's a DIY replacement for Skylight, Hearth
and similar units.

## Dev

```sh
cp .env.example .env   # set WALL_LAT / WALL_LON for weather
npm install
npm start              # http://localhost:4200, with /api served by src/server.ts
npm test
```

Node 24+ is required (the app uses the built-in `node:sqlite`).

## Prod

```sh
npm run build
npm run serve:prod     # http://localhost:4000
```

## Google Calendar

1. Put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`. The OAuth client's redirect URIs must include
   `http://localhost:4200/api/google/callback` (dev) and `http://localhost:4000/api/google/callback` (box).
   Keep the consent screen **In production**, or refresh tokens expire after 7 days.
2. Open **Settings → Connect Google account** via `localhost`. Google rejects LAN IPs as redirect
   URIs, so on the box use `ssh -L 4000:localhost:4000 <box>` from your PC.
3. Share each person's calendar with the household account ("Make changes to events"), then
   link it to that person in **Settings → People**. People without a calendar (kids) are
   wall-only: chores and streaks, no events. For kids' events, create a secondary calendar inside
   the household account and link it.

The server re-fetches 60 days back to 400 days ahead for each calendar every 90 s and replaces
the local cache (`src/server/google/sync.ts`).

## Parent PIN

A 4–8 digit PIN (Settings → Parent PIN) is asked for every time Settings opens, and before
adding, editing or removing chores for anyone with "Chore changes need PIN" switched on (on by
default for wall-only people, i.e. kids). Checking chores off never needs it. It's a speed bump
for kids, not security: the check is client-side, and five wrong tries locks the pad for 30 s.
Forgot it? Remove it from the box: `sqlite3 data/wall.db "UPDATE settings SET value='' WHERE key LIKE 'pin.%'"`.

## Errors and logs

- People only ever see friendly toasts. Errors read "Oops! Something went wrong." and stay until
  dismissed; success and warning toasts close themselves.
- Details go to `data/logs/wall-YYYY-MM-DD.log` (JSON lines, kept 14 days) and to stdout, which
  journald captures on the box: `journalctl -u wall-calendar -f`. Browser errors are sent to
  `POST /api/logs` and land in the same file.
- Settings → Diagnostics fires test toasts, sends a fake error to the log, and lists recent errors.

## Layout

- `src/app/`: the Angular UI. Every route renders client-side (`app.routes.server.ts`).
- `src/server.ts`: the Express entry point. It mounts `/api` and serves the SPA.
- `src/server/`: the API, the SQLite database (`db.ts`, append-only migrations) and the weather proxy.
- `data/`: the SQLite file. It's gitignored, so back it up.

`allowedHosts` is `*` because this runs only on a LAN and nothing is rendered on the server. Don't
expose it to the internet.

## Roadmap

1. ✅ Skeleton: Home screen with clock and weather, SQLite schema
2. ✅ Google Calendar sync: OAuth, calendar-to-person mapping, agenda/week/month views
3. ✅ Quick-add on the wall: + button or tap a day, pick a person, type on the built-in keyboard, then set the start and length with steppers. Edit and delete from event details. Phones use the Google Calendar app.
4. ✅ Chores and dinners: people who don't need a Google account (kids), chores that repeat daily, on set weekdays, or once (carrying over until done), streaks, and a week of dinner plans
5. Box: `setup.sh` (Ubuntu Server + cage + Chromium kiosk + systemd), dimming schedule
6. Polish: touch targets, return to Home when idle, readability from across the room
