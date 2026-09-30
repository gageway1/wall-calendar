import express from 'express';
import { db } from './db';
import { getWeather } from './weather';

export const api = express.Router();
api.use(express.json());

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

api.get('/people', (_req, res) => {
  res.json(db().prepare('SELECT * FROM people ORDER BY sort_order, name').all());
});

api.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

api.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[api]', err);
    res
      .status(500)
      .json({ error: 'internal', message: err instanceof Error ? err.message : String(err) });
  },
);
