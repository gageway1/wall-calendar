import { randomBytes } from 'node:crypto';
import { getSetting, setSetting } from '../db';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
];

export class GoogleError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ? `${code}: ${message}` : code);
  }
}

export class NotConnectedError extends Error {
  constructor() {
    super('Google account not connected');
  }
}

function credentials() {
  const id = process.env['GOOGLE_CLIENT_ID'];
  const secret = process.env['GOOGLE_CLIENT_SECRET'];
  if (!id || !secret)
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set in .env');
  return { id, secret };
}

export function isConfigured() {
  return !!process.env['GOOGLE_CLIENT_ID'] && !!process.env['GOOGLE_CLIENT_SECRET'];
}

export function isConnected() {
  return !!getSetting('google.refresh_token');
}

// OAuth `state` values we've handed out, so the callback can't be forged. In-memory is fine:
// a restart mid-login just means clicking Connect again.
const pendingStates = new Map<string, { redirectUri: string; at: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

export function buildAuthUrl(redirectUri: string) {
  const state = randomBytes(16).toString('hex');
  pendingStates.set(state, { redirectUri, at: Date.now() });

  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: credentials().id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    // offline + consent guarantees a refresh token even if this account authorized before.
    access_type: 'offline',
    prompt: 'consent',
    state,
  }).toString();
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { id, secret } = credentials();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...params }),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();
  if (!res.ok) throw new GoogleError(json.error ?? String(res.status), json.error_description);
  return json;
}

let accessToken: { token: string; expiresAt: number } | undefined;

export async function completeAuth(code: string, state: string) {
  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  if (!pending || Date.now() - pending.at > STATE_TTL_MS) {
    throw new GoogleError('invalid_state', 'Login expired or was started elsewhere. Try again.');
  }

  const tok = await tokenRequest({
    code,
    redirect_uri: pending.redirectUri,
    grant_type: 'authorization_code',
  });
  if (!tok.refresh_token) throw new GoogleError('no_refresh_token');

  setSetting('google.refresh_token', tok.refresh_token);
  setSetting('google.error', '');
  accessToken = { token: tok.access_token, expiresAt: Date.now() + tok.expires_in * 1000 };
}

export async function getAccessToken(): Promise<string> {
  if (accessToken && accessToken.expiresAt - 60_000 > Date.now()) return accessToken.token;

  const refreshToken = getSetting('google.refresh_token');
  if (!refreshToken) throw new NotConnectedError();

  try {
    const tok = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
    accessToken = { token: tok.access_token, expiresAt: Date.now() + tok.expires_in * 1000 };
    return tok.access_token;
  } catch (err) {
    if (err instanceof GoogleError && err.code === 'invalid_grant') {
      // Revoked, or the app got flipped back to Testing. Nothing to do but reconnect.
      disconnect();
      setSetting('google.error', 'Google access was revoked or expired. Reconnect in Settings.');
    }
    throw err;
  }
}

export function disconnect() {
  setSetting('google.refresh_token', '');
  setSetting('google.account', '');
  accessToken = undefined;
}
