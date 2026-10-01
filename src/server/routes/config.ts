import express from 'express';
import QRCode from 'qrcode';
import { getSetting, setSetting } from '../db';

/** Wall-wide display and guest settings, stored on the box. */
export const config = express.Router();

const SLEEP_DEFAULTS = { enabled: true, start: 22 * 60, end: 6 * 60 };
const WIFI_SECURITY = ['WPA', 'WEP', 'nopass'] as const;
type WifiSecurity = (typeof WIFI_SECURITY)[number];

function sleepConfig() {
  const raw = getSetting('display.sleep');
  try {
    return raw ? { ...SLEEP_DEFAULTS, ...JSON.parse(raw) } : SLEEP_DEFAULTS;
  } catch {
    return SLEEP_DEFAULTS;
  }
}

interface WifiConfig {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}

function wifiConfig(): WifiConfig | null {
  const raw = getSetting('wifi');
  try {
    return raw ? (JSON.parse(raw) as WifiConfig) : null;
  } catch {
    return null;
  }
}

/** Escapes per the Wi-Fi QR format (ZXing): \ ; , : " */
const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');

export function wifiQrPayload(w: WifiConfig): string {
  const pass = w.security === 'nopass' ? '' : `P:${esc(w.password)};`;
  return `WIFI:T:${w.security};S:${esc(w.ssid)};${pass}${w.hidden ? 'H:true;' : ''};`;
}

config.get('/sleep', (_req, res) => {
  res.json(sleepConfig());
});

config.put('/sleep', (req, res) => {
  const { enabled, start, end } = req.body ?? {};
  const validMin = (v: unknown) =>
    Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1440;
  if (typeof enabled !== 'boolean' || !validMin(start) || !validMin(end) || start === end) {
    res.status(400).json({ error: 'invalid sleep schedule' });
    return;
  }
  setSetting('display.sleep', JSON.stringify({ enabled, start, end }));
  res.json(sleepConfig());
});

/** Includes the password: the whole point is showing it to guests on the wall. */
config.get('/wifi', (_req, res) => {
  const w = wifiConfig();
  res.json(w ? { configured: true, ...w } : { configured: false });
});

config.put('/wifi', (req, res) => {
  const { ssid, password, security, hidden } = req.body ?? {};
  if (typeof ssid !== 'string' || !ssid.trim() || ssid.length > 64) {
    res.status(400).json({ error: 'network name is required' });
    return;
  }
  const sec: WifiSecurity = WIFI_SECURITY.includes(security) ? security : 'WPA';
  if (sec !== 'nopass' && (typeof password !== 'string' || !password)) {
    res.status(400).json({ error: 'password is required' });
    return;
  }
  setSetting(
    'wifi',
    JSON.stringify({
      ssid: ssid.trim(),
      password: sec === 'nopass' ? '' : password,
      security: sec,
      hidden: hidden === true,
    }),
  );
  res.status(204).end();
});

config.delete('/wifi', (_req, res) => {
  setSetting('wifi', '');
  res.status(204).end();
});

config.get('/wifi/qr.svg', async (_req, res) => {
  const w = wifiConfig();
  if (!w) {
    res.status(404).json({ error: 'not_configured' });
    return;
  }
  const svg = await QRCode.toString(wifiQrPayload(w), {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  res.type('image/svg+xml').set('cache-control', 'no-store').send(svg);
});
