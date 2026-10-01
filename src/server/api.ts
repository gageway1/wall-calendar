import express from 'express';
import { NotConnectedError } from './google/oauth';
import { log } from './logger';
import { networkErrorCode } from './net-errors';
import { ensureSyncLoop } from './google/sync';
import { events } from './routes/events';
import { google } from './routes/google';
import { logs } from './routes/logs';
import { people } from './routes/people';
import { getWeather } from './weather';

export const api = express.Router();
api.use(express.json());

// Background sync starts with the first request rather than at import, so `ng build`
// (which imports the server to extract routes) never kicks it off.
api.use((_req, _res, next) => {
  ensureSyncLoop();
  next();
});

api.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

api.get('/weather', async (_req, res, next) => {
  try {
    const weather = await getWeather();
    if (!weather) {
      res.status(404).json({ error: 'location_not_configured' });
      return;
    }
    res.json(weather);
  } catch (err) {
    next(err);
  }
});

api.use('/google', google);
api.use('/people', people);
api.use('/events', events);
api.use('/logs', logs);

api.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

api.use(
  (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof NotConnectedError) {
      res.status(409).json({ error: 'google_not_connected' });
      return;
    }
    // Couldn't reach Google/Open-Meteo/the internet: expected now and then, not a bug.
    const offline = networkErrorCode(err);
    if (offline) {
      log('warn', 'api', `${req.method} ${req.originalUrl}: internet unreachable (${offline})`);
      res.status(503).json({ error: 'unreachable' });
      return;
    }
    // Details go to the log, never to the screen.
    log('error', 'api', `${req.method} ${req.originalUrl} failed`, err);
    res.status(500).json({ error: 'internal' });
  },
);
