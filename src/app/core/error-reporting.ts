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

/** Uncaught exceptions anywhere in the app: log them, tell the user gently. */
@Injectable()
export class ToastErrorHandler implements ErrorHandler {
  private readonly toasts = inject(ToastService);

  handleError(error: unknown) {
    console.error(error);
    try {
      reportError(error instanceof Error ? error.message : String(error), error);
      this.toasts.error(GENERIC_ERROR);
    } catch {}
  }
}
