import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Parent PIN: hashing and a tiny lockout so a kid can't just try every code. */

export const PIN_FORMAT = /^\d{4,8}$/;
const MAX_FAILURES = 5;
const LOCKOUT_MS = 30_000;

export function hashPin(pin: string, salt = randomBytes(16).toString('hex')): string {
  return `${salt}:${createHash('sha256')
    .update(salt + pin)
    .digest('hex')}`;
}

export function pinMatches(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = hashPin(pin, salt).split(':')[1];
  return timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

/** Counts consecutive failures; after MAX_FAILURES, refuses attempts for LOCKOUT_MS. */
export class Lockout {
  private failures = 0;
  private lockedUntil = 0;

  /** ms remaining if locked, else 0. */
  remaining(now = Date.now()): number {
    return Math.max(0, this.lockedUntil - now);
  }

  record(success: boolean, now = Date.now()) {
    if (success) {
      this.failures = 0;
      return;
    }
    if (++this.failures >= MAX_FAILURES) {
      this.failures = 0;
      this.lockedUntil = now + LOCKOUT_MS;
    }
  }
}
