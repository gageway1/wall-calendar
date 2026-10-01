import { GoogleError, getAccessToken } from './oauth';

/** The connected account was authorized before this feature's permission existed. */
export class ScopeMissingError extends Error {
  constructor() {
    super('Google permission missing; reconnect to grant it');
  }
}

/** The API isn't enabled in the Google Cloud project yet. */
export class ApiDisabledError extends Error {
  constructor(readonly api: string) {
    super(`${api} is not enabled in the Google Cloud project`);
  }
}

/** Authenticated JSON request to any Google REST API. */
export async function googleRequest<T>(
  url: string,
  query: Record<string, string | undefined> = {},
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getAccessToken();
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) if (v !== undefined) u.searchParams.set(k, v);

  const res = await fetch(u, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body !== undefined && { 'content-type': 'application/json' }),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = body?.error;
    const reasons: string[] = (err?.details ?? []).map((d: { reason?: string }) => d.reason);
    if (res.status === 403 && reasons.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
      throw new ScopeMissingError();
    }
    if (res.status === 403 && reasons.includes('SERVICE_DISABLED')) {
      throw new ApiDisabledError(u.hostname);
    }
    throw new GoogleError(String(res.status), err?.message);
  }
  return (
    res.status === 204 || res.headers.get('content-length') === '0' ? undefined : res.json()
  ) as Promise<T>;
}
