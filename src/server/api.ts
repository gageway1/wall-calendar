import express from 'express';
import { NotConnectedError } from './google/oauth';
import { ensureSyncLoop } from './google/sync';
import { events } from './routes/events';
import { google } from './routes/google';
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

api.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

api.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof NotConnectedError) {
      res.status(409).json({ error: 'google_not_connected' });
      return;
    }
    console.error('[api]', err);
    res
      .status(500)
      .json({ error: 'internal', message: err instanceof Error ? err.message : String(err) });
  },
);
