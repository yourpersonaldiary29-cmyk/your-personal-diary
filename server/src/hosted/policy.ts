/**
 * Registration policy of the hosted server (docs/HOSTED-PLAN.md Part B 2.6, review finding 9).
 *
 * Registration is open to the internet, protected by:
 *   - the register limiter: REGISTER_PER_HOUR and REGISTER_PER_DAY attempts per address bucket
 *     (the /64 for IPv6, the address for IPv4 - middleware/access.ts `limiterKey`), counted on every
 *     attempt, successful or not -> 429 'server.auth.tooManyRegistrations';
 *   - the mode: `closed` -> 403 'server.auth.registrationClosed'; `invite` -> the body must carry
 *     the invite code (400 'server.auth.inviteRequired' / 403 'server.auth.inviteInvalid', compared
 *     in constant time); `open` -> no code;
 *   - the account cap (`DIARY_MAX_ACCOUNTS`) -> 503 'server.auth.registrationFull'.
 * There is deliberately NO global daily cap (one /64 holder could otherwise block everyone for a
 * day): a 24 h counter of successful registrations feeds the owner's Server card and a warning
 * line above REGISTRATION_WARN_PER_DAY; the mode switch is the real brake - `closed`, or `invite`
 * only together with DIARY_INVITE_CODE (invite mode without a code never starts: config.ts).
 *
 * Only the hosted composition imports this module (app.ts sees the `RegistrationGate` type only).
 */
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { RegistrationMode } from '../config';
import { ApiError } from '../errors';
import { clientIp, limiterKey } from '../middleware/access';
import type { GuestGate, RegistrationGate } from './types';

export const REGISTER_PER_HOUR = 5;
export const REGISTER_PER_DAY = 20;
/** Above this many registrations in 24 hours the server logs a warning (and the card shows the number). */
export const REGISTRATION_WARN_PER_DAY = 50;

export const REGISTRATION_CLOSED_KEY = 'server.auth.registrationClosed';
export const INVITE_REQUIRED_KEY = 'server.auth.inviteRequired';
export const INVITE_INVALID_KEY = 'server.auth.inviteInvalid';
export const REGISTRATION_FULL_KEY = 'server.auth.registrationFull';
export const TOO_MANY_REGISTRATIONS_KEY = 'server.auth.tooManyRegistrations';

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
/** Bound on remembered buckets (a flood of addresses must not grow the map without limit). */
const MAX_BUCKETS = 10_000;

export interface RegisterLimiterOptions {
  perHour?: number;
  perDay?: number;
  now?: () => number;
}

/** Sliding one-hour / one-day windows per address bucket. */
export class RegisterLimiter {
  private readonly hits = new Map<string, number[]>();
  readonly perHour: number;
  readonly perDay: number;
  private readonly now: () => number;

  constructor(opts: RegisterLimiterOptions = {}) {
    this.perHour = opts.perHour ?? REGISTER_PER_HOUR;
    this.perDay = opts.perDay ?? REGISTER_PER_DAY;
    this.now = opts.now ?? Date.now;
  }

  /** Counts one attempt of `bucket`; false when the bucket is over either window (the attempt is still counted). */
  hit(bucket: string): boolean {
    const t = this.now();
    const times = (this.hits.get(bucket) ?? []).filter((x) => t - x < DAY_MS);
    const lastHour = times.filter((x) => t - x < HOUR_MS).length;
    const allowed = lastHour < this.perHour && times.length < this.perDay;
    times.push(t);
    this.hits.delete(bucket);
    this.hits.set(bucket, times);
    if (this.hits.size > MAX_BUCKETS) {
      for (const [key, arr] of this.hits) {
        if (!arr.length || t - arr[arr.length - 1] >= DAY_MS) this.hits.delete(key);
        if (this.hits.size <= MAX_BUCKETS) break;
      }
      if (this.hits.size > MAX_BUCKETS) {
        const oldest = this.hits.keys().next().value;
        if (oldest !== undefined) this.hits.delete(oldest);
      }
    }
    return allowed;
  }

  /** Attempts of `bucket` in the last hour / day (tests, diagnostics). */
  count(bucket: string): { hour: number; day: number } {
    const t = this.now();
    const times = (this.hits.get(bucket) ?? []).filter((x) => t - x < DAY_MS);
    return { hour: times.filter((x) => t - x < HOUR_MS).length, day: times.length };
  }
}

/** Successful registrations in a sliding 24 h window. */
export class RegistrationCounter {
  private times: number[] = [];
  constructor(private readonly now: () => number = Date.now) {}

  add(): number {
    const t = this.now();
    this.times = this.times.filter((x) => t - x < DAY_MS);
    this.times.push(t);
    return this.times.length;
  }

  count(): number {
    const t = this.now();
    this.times = this.times.filter((x) => t - x < DAY_MS);
    return this.times.length;
  }
}

/** Constant-time comparison of two invite codes (length differences still cost a comparison). */
export function inviteMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given.normalize('NFKC'), 'utf8');
  const b = Buffer.from(expected.normalize('NFKC'), 'utf8');
  if (!expected || a.length !== b.length) {
    timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return timingSafeEqual(a, b);
}

export interface RegistrationGateOptions {
  mode: RegistrationMode;
  /** Required when `mode` is 'invite'. Secret: never logged. */
  inviteCode?: string;
  maxAccounts: number;
  /** How many accounts exist now (the hard ceiling is checked against it on every attempt). */
  countAccounts: () => number;
  limiter?: RegisterLimiter;
  now?: () => number;
  log?: (line: string) => void;
}

export function createRegistrationGate(opts: RegistrationGateOptions): RegistrationGate & { limiter: RegisterLimiter; counter: RegistrationCounter } {
  const now = opts.now ?? Date.now;
  const limiter = opts.limiter ?? new RegisterLimiter({ now });
  const counter = new RegistrationCounter(now);
  const log = opts.log ?? ((line: string) => console.error(`[diary-server] ${line}`));
  const inviteCode = opts.inviteCode ?? '';
  if (opts.mode === 'invite' && !inviteCode) throw new Error('registration mode "invite" needs an invite code');
  let refusedSinceLog = 0;
  let lastRateLogAt = 0;
  return {
    mode: opts.mode,
    maxAccounts: opts.maxAccounts,
    limiter,
    counter,
    check(req: Request, body: Record<string, unknown>): void {
      // Counted first, whatever happens next: a closed door and a wrong code are attempts too.
      if (!limiter.hit(limiterKey(clientIp(req)))) {
        // Counters only, never addresses (2.8).
        refusedSinceLog++;
        const t = now();
        if (t - lastRateLogAt >= 60_000) {
          log(`register refused (rate): ${refusedSinceLog} in the last minute`);
          refusedSinceLog = 0;
          lastRateLogAt = t;
        }
        throw ApiError.localized(429, 'FORBIDDEN', TOO_MANY_REGISTRATIONS_KEY);
      }
      if (opts.mode === 'closed') throw ApiError.forbidden(REGISTRATION_CLOSED_KEY);
      if (opts.mode === 'invite') {
        const given = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : '';
        if (!given) throw ApiError.validation(INVITE_REQUIRED_KEY, 'inviteCode');
        if (!inviteMatches(given, inviteCode)) throw ApiError.forbidden(INVITE_INVALID_KEY);
      }
      if (opts.countAccounts() >= opts.maxAccounts) throw ApiError.localized(503, 'OTHER', REGISTRATION_FULL_KEY);
    },
    registered(): void {
      const n = counter.add();
      if (n === REGISTRATION_WARN_PER_DAY + 1 || (n > REGISTRATION_WARN_PER_DAY && n % 50 === 0)) {
        // Never advise `invite` alone: without DIARY_INVITE_CODE the hosted server does not start (loadHostedEnv).
        log(`registrations in the last 24 h: ${n} - consider DIARY_REGISTRATION=closed (invite only together with DIARY_INVITE_CODE)`);
      }
    },
    recentCount(): number {
      return counter.count();
    },
  };
}

// The tour (docs/android-tasks/HOSTED-IMPL.md item 9) ------------------------------------------

/** Tours one address bucket may start per hour (`DIARY_GUESTS_PER_HOUR`). */
export const GUESTS_PER_HOUR = 3;
/** Concurrent guests the server keeps (`DIARY_MAX_GUESTS`; 0 = the tour is not mounted). */
export const MAX_GUESTS = 20;
/** Minutes a tour lives before the server ends it by itself (`DIARY_GUEST_MINUTES`). */
export const GUEST_LIFETIME_MINUTES = 30;
export const TOO_MANY_GUESTS_KEY = 'server.auth.tooManyGuests';

export interface GuestGateOptions {
  perHour?: number;
  max?: number;
  lifetimeMinutes?: number;
  now?: () => number;
  log?: (line: string) => void;
}

/**
 * The per-bucket limit of the tour: `perHour` attempts per hour (and eight times that per day),
 * counted on every attempt - refused ones too -> 429 'server.auth.tooManyGuests'. The cap of
 * concurrent guests (503 'server.auth.guestsFull') and the lifetime are enforced by the auth
 * service, which owns the guests; the gate only carries those numbers for the Server card.
 */
export function createGuestGate(opts: GuestGateOptions = {}): GuestGate & { limiter: RegisterLimiter } {
  const perHour = opts.perHour ?? GUESTS_PER_HOUR;
  const now = opts.now ?? Date.now;
  const limiter = new RegisterLimiter({ perHour, perDay: perHour * 8, now });
  const log = opts.log ?? ((line: string) => console.error(`[diary-server] ${line}`));
  let refusedSinceLog = 0;
  let lastRateLogAt = 0;
  return {
    perHour,
    max: opts.max ?? MAX_GUESTS,
    lifetimeMinutes: opts.lifetimeMinutes ?? GUEST_LIFETIME_MINUTES,
    limiter,
    check(req: Request): void {
      if (limiter.hit(limiterKey(clientIp(req)))) return;
      // Counters only, never addresses (2.8).
      refusedSinceLog++;
      const t = now();
      if (t - lastRateLogAt >= 60_000) {
        log(`tour refused (rate): ${refusedSinceLog} in the last minute`);
        refusedSinceLog = 0;
        lastRateLogAt = t;
      }
      throw ApiError.localized(429, 'FORBIDDEN', TOO_MANY_GUESTS_KEY);
    },
  };
}
