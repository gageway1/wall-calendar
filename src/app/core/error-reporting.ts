import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { GENERIC_ERROR, ToastService } from './toast.service';

export const OFFLINE_WARNING = "Can't reach the calendar right now. Showing the last saved events.";
export const RECONNECT_WARNING = 'Google needs to be reconnected in Settings.';

const RESEND_AFTER_MS = 10_000;
const recentlySent = new Map<string, number>();

/**
 * Sends an error to the server log (data/logs). Fire-and-forget, deduped for 10 s so a failure
 * loop can't flood the log, and never throws.
 */
export function reportError(message: string, detail?: unknown, level: 'error' | 'warn' = 'error') {
  if (typeof message !== 'string') message = describeError(message);
  const now = Date.now();
  if (now - (recentlySent.get(message) ?? 0) < RESEND_AFTER_MS) return;
  recentlySent.set(message, now);

  try {
    void fetch('/api/logs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ level, message, detail: toPlain(detail), url: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

function toPlain(detail: unknown): unknown {
  if (detail instanceof Error)
    return { name: detail.name, message: detail.message, stack: detail.stack };
  if (detail instanceof HttpErrorResponse) {
    return { status: detail.status, url: detail.url, error: detail.error };
  }
  return detail;
}

/**
 * Turns HTTP failures into friendly toasts. Background reads (polling) only ever warn, since the
 * wall keeps showing cached data; failed writes are real errors.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const toasts = inject(ToastService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (!req.url.startsWith('/api/logs')) handleHttpError(toasts, req, err);
      return throwError(() => err);
    }),
  );
};

function handleHttpError(toasts: ToastService, req: HttpRequest<unknown>, err: HttpErrorResponse) {
  // Explained on the screen itself (e.g. Lists shows setup steps).
  if (
    err.status === 409 &&
    ['google_scope_missing', 'google_api_disabled'].includes(err.error?.error)
  ) {
    return;
  }
  if (err.status === 409 && err.error?.error === 'google_not_connected') {
    toasts.warn(RECONNECT_WARNING);
    return;
  }

  const serverOrNetwork = err.status === 0 || err.status >= 500;
  if (req.method === 'GET') {
    // 404s here are expected states (e.g. weather not configured); only outages are worth a word.
    if (serverOrNetwork) toasts.warn(OFFLINE_WARNING);
    return;
  }

  toasts.error(GENERIC_ERROR);
  reportError(`${req.method} ${req.url} failed (${err.status || 'network'})`, err);
}

/** A readable one-line description of anything that can be thrown. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (error instanceof HttpErrorResponse)
    return `HTTP ${error.status || 'network'} ${error.url ?? ''}`.trim();
  if (typeof error === 'string') return error;
  if (error === null || typeof error !== 'object') return String(error);
  try {
    const json = JSON.stringify(error);
    if (json && json !== '{}') return json.slice(0, 300);
  } catch {}
  return `Unknown error (${error.constructor?.name ?? 'object'})`;
}

/** Uncaught exceptions anywhere in the app: log them, tell the user gently. */
@Injectable()
export class ToastErrorHandler implements ErrorHandler {
  private readonly toasts = inject(ToastService);

  handleError(error: unknown) {
    // Unhandled promise rejections arrive wrapped.
    const e = (error as { rejection?: unknown })?.rejection ?? error;
    console.error(e);
    // HTTP failures were already toasted (and logged if serious) by the interceptor; a
    // subscribe() without an error callback re-throws them here, so don't report twice.
    if (e instanceof HttpErrorResponse) return;
    try {
      reportError(describeError(e), e);
      this.toasts.error(GENERIC_ERROR);
    } catch {}
  }
}
