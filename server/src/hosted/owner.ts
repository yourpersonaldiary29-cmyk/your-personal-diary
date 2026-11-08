/**
 * The owner of a hosted server (docs/HOSTED-PLAN.md 2.3, review finding 6): `DIARY_OWNER_ID` and
 * nothing else. There is no "first account" fallback - on a public server the next-oldest account
 * is a stranger - so while the variable is unset, or names an account that does not exist, every
 * owner-only route answers 403 'server.owner.unset' to everyone, and a log line says so (at most
 * once a minute). Pure: no imports beyond the errors module.
 */
import { ApiError } from '../errors';

/** Catalogue key of the 403 answered while the hosted server has no (valid) owner configured. */
export const OWNER_UNSET_KEY = 'server.owner.unset';

export interface HostedOwnerRule {
  /** The configured owner id ('' when unset). */
  ownerId: () => string;
  accountExists: (id: string) => boolean;
  log?: (line: string) => void;
}

const LOG_EVERY_MS = 60_000;

/**
 * Decides owner-only requests. Returns normally when `userId` is the configured owner and that
 * account exists; throws 403 'server.owner.unset' when no valid owner is configured (for everyone,
 * the would-be owner included) and 403 'server.error.forbidden' for any other account.
 */
export function hostedOwnerGate(rule: HostedOwnerRule, now: () => number = Date.now) {
  let lastLogAt = 0;
  const say = (line: string) => {
    const t = now();
    if (t - lastLogAt < LOG_EVERY_MS) return;
    lastLogAt = t;
    (rule.log ?? ((l: string) => console.error(`[diary-server] ${l}`)))(line);
  };
  return {
    /** True when a valid owner is configured (the id names an existing account). */
    configured(): boolean {
      const id = rule.ownerId();
      return !!id && rule.accountExists(id);
    },
    /** True when `userId` is the configured, existing owner. Never throws. */
    isOwner(userId: string): boolean {
      const id = rule.ownerId();
      return !!id && id === userId && rule.accountExists(id);
    },
    /** Throws the 403 of the rule when `userId` may not use an owner-only route. */
    assert(userId: string): void {
      const id = rule.ownerId();
      if (!id) {
        say('Owner cards are off: DIARY_OWNER_ID is not set. Register the owner account, then set the variable to its account id.');
        throw ApiError.forbidden(OWNER_UNSET_KEY);
      }
      if (!rule.accountExists(id)) {
        say('Owner cards are off: DIARY_OWNER_ID names an account that does not exist on this server.');
        throw ApiError.forbidden(OWNER_UNSET_KEY);
      }
      if (id !== userId) throw ApiError.forbidden();
    },
  };
}

export type HostedOwnerGate = ReturnType<typeof hostedOwnerGate>;
