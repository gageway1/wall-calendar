import { getSetting } from './db';

export interface Weather {
  location: string;
  current: { temp: number; code: number; isDay: boolean };
  daily: { date: string; high: number; low: number; code: number; precipChance: number }[];
  units: 'fahrenheit' | 'celsius';
  fetchedAt: string;
}

const CACHE_MS = 10 * 60 * 1000;
let cache: { key: string; at: number; data: Weather } | undefined;

/** Location comes from settings, falling back to env for first boot. */
export function weatherLocation() {
  const lat = getSetting('weather.lat') ?? process.env['WALL_LAT'];
  const lon = getSetting('weather.lon') ?? process.env['WALL_LON'];
  const name = getSetting('weather.name') ?? process.env['WALL_LOCATION_NAME'] ?? '';
  const units = (getSetting('weather.units') ?? process.env['WALL_UNITS'] ?? 'fahrenheit') as
    'fahrenheit' | 'celsius';
  return lat && lon ? { lat, lon, name, units } : undefined;
}

export async function getWeather(): Promise<Weather | undefined> {
  const loc = weatherLocation();
  if (!loc) return undefined;

  const key = `${loc.lat},${loc.lon},${loc.units}`;
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.data;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: loc.lat,
    longitude: loc.lon,
    current: 'temperature_2m,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit: loc.units,
    timezone: 'auto',
    forecast_days: '7',
  }).toString();

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const j = await res.json();
    const data: Weather = {
      location: loc.name,
      units: loc.units,
      current: {
        temp: Math.round(j.current.temperature_2m),
        code: j.current.weather_code,
        isDay: j.current.is_day === 1,
      },
      daily: (j.daily.time as string[]).map((date, i) => ({
        date,
        high: Math.round(j.daily.temperature_2m_max[i]),
        low: Math.round(j.daily.temperature_2m_min[i]),
        code: j.daily.weather_code[i],
        precipChance: j.daily.precipitation_probability_max[i] ?? 0,
      })),
      fetchedAt: new Date().toISOString(),
    };
    cache = { key, at: Date.now(), data };
    return data;
  } catch (err) {
    // Serve stale data rather than blanking the wall when the internet blips.
    if (cache?.key === key) return cache.data;
    throw err;
  }
}
