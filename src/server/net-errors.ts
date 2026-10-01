const NETWORK_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

/**
 * If `err` means "couldn't reach the internet/Google" (as opposed to a bug), returns a short code
 * like ENOTFOUND or TIMEOUT. Node's fetch wraps the real reason in `cause`, so walk the chain.
 */
export function networkErrorCode(err: unknown): string | undefined {
  let sawFetchFailed = false;
  for (let e: any = err, depth = 0; e && depth < 5; e = e.cause, depth++) {
    if (typeof e.code === 'string' && NETWORK_CODES.has(e.code)) return e.code;
    if (e.name === 'TimeoutError' || e.name === 'AbortError') return 'TIMEOUT';
    if (e.message === 'fetch failed') sawFetchFailed = true;
  }
  return sawFetchFailed ? 'FETCH_FAILED' : undefined;
}
