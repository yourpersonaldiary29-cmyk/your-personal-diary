/**
 * "Forgot password?" - password reset by e-mail (docs/API.md "איפוס סיסמה", ARCHITECTURE.md section 5).
 *
 *   request()          POST /api/auth/forgot-password: validates the address, checks that mail is set
 *                      up (503 'server.mail.notConfigured' otherwise), rate-limits per IP and per
 *                      address, and ALWAYS returns without telling whether the address is registered.
 *                      For a registered address whose account has a recovery key, a reset
 *                      (link token + 6-digit code, 30 minutes, single use) is created and e-mailed in
 *                      the background - in the account's language - so neither the answer nor its
 *                      timing depends on the address being registered. An account without a recovery
 *                      key yet gets an e-mail without link or code that says why ("sign in once").
 *                      The language is the copy in the registry (AccountRecord.language), else the
 *                      request language: a request NEVER opens the diary of the account and never
 *                      unwraps its recovery key - only its presence is checked (DiaryAuthService.
 *                      canResetPassword; docs/android-tasks/PRIVACY-HARDENING.md item 1); the same
 *                      goes for the notices.
 *   resetWithToken()   POST /api/auth/reset-password with the link token
 *   resetWithCode()    POST /api/auth/reset-password with the e-mail address + code
 *                      -> the reset is taken (single use), the diary is re-encrypted under the new
 *                      password (DiaryAuthService.resetPassword: recovery key, sign out everywhere,
 *                      lockouts cleared) and a short "your password was changed" notice is e-mailed.
 */
import { randomInt } from 'node:crypto';
import type { Locale } from '@shared/i18n';
import { ApiError } from '../errors';
import { mailFailureTag, MAIL_NOT_CONFIGURED_KEY } from '../mail/errors';
import type { MailContent } from '../mail/mime';
import { emailChangedEmail, passwordChangedEmail, resetEmail, resetUnavailableEmail } from '../mail/templates';
import { normalizeEmail } from './accounts';
import { recentPreviousEmail, resetInvalid, validateEmail, type DiaryAuthService } from './auth-service';
import type { ResetRecord } from './resets';
import type { AccountRecord } from './session-types';

/** Requests per address per hour (any address - registered or not - so the limit reveals nothing). */
export const RESET_REQUESTS_PER_ADDRESS_PER_HOUR = 5;
/** Requests per IP address per hour. */
export const RESET_REQUESTS_PER_IP_PER_HOUR = 10;
/**
 * Wrong 6-digit codes accepted per account per day. Each reset dies after 5 wrong codes anyway;
 * this cap stops an attacker from asking for new codes again and again to keep guessing (once it
 * is reached, codes are refused for the day - with the same "invalid" answer - but links still work).
 */
export const RESET_CODE_FAILURES_PER_ACCOUNT_PER_DAY = 10;
/** Catalogue key of the 429 answered when a limit is reached. */
export const RESET_TOO_MANY_KEY = 'server.reset.tooMany';
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
/** Bound on the remembered keys of each limiter. */
const LIMITER_MAX_KEYS = 10_000;

/** What the reset needs from the mail service. */
export interface ResetMailer {
  ready(): boolean;
  send(content: MailContent): Promise<void>;
}

export interface PasswordResetOptions {
  perAddressPerHour?: number;
  perIpPerHour?: number;
  now?: () => Date;
  /** Log line for background failures (default: stderr -> server.log). Never gets an address or a secret. */
  log?: (line: string) => void;
  /**
   * Milliseconds to wait before the e-mail work of a request starts (default: a random
   * 200-1200 ms, see `randomBackgroundDelay`). Tests pass `() => 0`.
   */
  backgroundDelayMs?: () => number;
}

/**
 * Random pause before the account-dependent work of a forgot-password request (creating the
 * reset, reading the account's language, talking to the SMTP server). That work runs after the
 * answer anyway, but it keeps the server busy for a few milliseconds - only for registered
 * addresses. Without the pause, a request sent right behind the forgot-password request could
 * notice that short stall and tell registered addresses from unknown ones; with it, the stall
 * happens at an unpredictable moment, somewhere in a second, among the rest of the traffic.
 */
export function randomBackgroundDelay(): number {
  return randomInt(200, 1201);
}

export interface ForgotInput {
  email: string;
  /** Socket address of the caller (rate limit). */
  ip: string;
  /** Request language - used when the account has no language in the registry yet (AccountRecord.language). */
  locale: Locale;
  /** `https://<remote hostname>` while remote access is on, otherwise `http://127.0.0.1:<port>`. */
  linkBase: string;
  /**
   * Composes the link of the e-mail from the token, for an app that is not reached over HTTP (the
   * phone: its deep link, mobile/core/app.ts). Default: `<linkBase>/#/reset-password?token=<token>`,
   * the reset page of the UI served at `linkBase`.
   */
  resetLink?: (token: string) => string;
}

/** Sliding-window counter per key. */
class WindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => Date,
  ) {}

  private recent(key: string, t: number): number[] {
    return (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
  }

  /** Forgets every hit of `key`. */
  forget(key: string): void {
    this.hits.delete(key);
  }

  /** Hits of `key` in the current window. */
  count(key: string): number {
    return this.recent(key, this.now().getTime()).length;
  }

  /** True when the key already reached the limit in the current window. */
  blocked(key: string): boolean {
    return this.recent(key, this.now().getTime()).length >= this.max;
  }

  /** Records a hit; false (and nothing recorded) when the key already reached the limit in the window. */
  hit(key: string): boolean {
    const t = this.now().getTime();
    const recent = this.recent(key, t);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.delete(key);
    this.hits.set(key, recent);
    if (this.hits.size > LIMITER_MAX_KEYS) {
      const oldest = this.hits.keys().next().value;
      if (oldest !== undefined) this.hits.delete(oldest);
    }
    return true;
  }
}

export class PasswordResetService {
  private readonly pending = new Set<Promise<void>>();
  private readonly byIp: WindowLimiter;
  private readonly byAddress: WindowLimiter;
  private readonly codeFailures: WindowLimiter;
  private readonly now: () => Date;
  private readonly log: (line: string) => void;
  private readonly delayMs: () => number;

  constructor(
    private readonly auth: DiaryAuthService,
    private readonly mail: ResetMailer,
    opts: PasswordResetOptions = {},
  ) {
    this.now = opts.now ?? (() => new Date());
    this.log = opts.log ?? ((line) => console.error(`[diary-server] ${line}`));
    this.delayMs = opts.backgroundDelayMs ?? randomBackgroundDelay;
    this.byIp = new WindowLimiter(opts.perIpPerHour ?? RESET_REQUESTS_PER_IP_PER_HOUR, HOUR_MS, this.now);
    this.byAddress = new WindowLimiter(opts.perAddressPerHour ?? RESET_REQUESTS_PER_ADDRESS_PER_HOUR, HOUR_MS, this.now);
    this.codeFailures = new WindowLimiter(RESET_CODE_FAILURES_PER_ACCOUNT_PER_DAY, DAY_MS, this.now);
    // A deleted account leaves nothing behind, not even its wrong-code counter.
    auth.onAccountDeleted?.((userId) => this.codeFailures.forget(userId));
    // The operator's unlock (admin tool) lets the account use reset codes again today, too.
    auth.onAccountUnlocked?.((userId) => this.codeFailures.forget(userId));
  }

  /** Wrong codes counted today for `userId` (tests / diagnostics). */
  codeFailuresOf(userId: string): number {
    return this.codeFailures.count(userId);
  }

  /**
   * Runs e-mail work after the answer was written (setImmediate / a timer: not even the synchronous
   * start of `work` runs before the route has answered), after the random pause of
   * `randomBackgroundDelay`; failures go to the log (no address, no secret).
   */
  private background(what: string, work: () => Promise<void>): void {
    const delay = Math.max(0, Math.floor(this.delayMs()) || 0);
    const job = new Promise<void>((resolve) => (delay > 0 ? setTimeout(resolve, delay) : setImmediate(resolve)))
      .then(work)
      .catch((e: unknown) => this.log(`${what} was not sent: ${mailFailureTag(e)}`));
    this.pending.add(job);
    void job.finally(() => this.pending.delete(job));
  }

  /** Resolves when every background e-mail has been handed over (or failed). Tests / shutdown. */
  async idle(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  /** POST /api/auth/forgot-password (see the file comment). Throws only for input, set-up and rate limits. */
  request(input: ForgotInput): void {
    const email = validateEmail(typeof input.email === 'string' ? input.email : '');
    if (!this.mail.ready()) throw ApiError.localized(503, 'OTHER', MAIL_NOT_CONFIGURED_KEY);
    if (!this.byIp.hit(input.ip || 'unknown')) throw ApiError.localized(429, 'FORBIDDEN', RESET_TOO_MANY_KEY);
    if (!this.byAddress.hit(normalizeEmail(email))) throw ApiError.localized(429, 'FORBIDDEN', RESET_TOO_MANY_KEY);
    const found = this.auth.accounts.findByEmail(email);
    if (!found?.email) return;
    const requestedFor = normalizeEmail(found.email);
    // Everything that depends on the account happens after the answer (same answer, same timing).
    this.background('A password-reset e-mail', async () => {
      // Read again after the pause: an account deleted meanwhile gets nothing, and an address that
      // was changed meanwhile must not receive a link (the change voided the resets of the old one).
      const account = this.auth.accounts.findById(found.id);
      if (!account?.email || normalizeEmail(account.email) !== requestedFor) return;
      const to = account.email;
      if (!this.auth.canResetPassword(account)) {
        this.log('A password reset was requested for an account without a recovery key (it is created at its next sign-in).');
        // No link or code (the diary cannot be opened without the password), but the mailbox owner
        // learns why nothing else arrives and what to do - the requester still sees the same answer.
        // In the request language, as it always was: such an account has not signed in since the
        // recovery key exists, so it has no language in the registry either (and its diary is never
        // opened for one).
        await this.mail.send(resetUnavailableEmail(input.locale, { to, firstName: account.firstName, username: account.username }));
        return;
      }
      const created = this.auth.resets.create(account.id);
      const link = input.resetLink ? input.resetLink(created.token) : `${input.linkBase.replace(/\/+$/, '')}/#/reset-password?token=${created.token}`;
      const locale = this.auth.accountLocale(account) ?? input.locale;
      await this.mail.send(
        resetEmail(locale, {
          to,
          firstName: account.firstName,
          username: account.username,
          link,
          code: created.code,
          minutes: Math.round(this.auth.resets.ttlMs / 60_000),
          localLink: /^http:\/\/127\.0\.0\.1[:/]/.test(input.linkBase),
        }),
      );
    });
  }

  /** POST /api/auth/reset-password with the link token. The new password was validated by the caller. Returns the account. */
  async resetWithToken(token: string, newPassword: string, locale: Locale): Promise<AccountRecord> {
    const record = this.auth.resets.takeByToken(token);
    if (!record) throw resetInvalid();
    return this.finish(record, newPassword, locale);
  }

  /** POST /api/auth/reset-password with the e-mail address + 6-digit code. */
  async resetWithCode(email: string, code: string, newPassword: string, locale: Locale): Promise<AccountRecord> {
    const account = typeof email === 'string' && email.trim() ? this.auth.accounts.findByEmail(email) : null;
    if (!account) throw resetInvalid();
    // Past the daily cap of wrong codes the code path answers "invalid" for this account (links still work).
    if (this.codeFailures.blocked(account.id)) throw resetInvalid();
    const record = this.auth.resets.takeByCode(account.id, code);
    if (!record) {
      this.codeFailures.hit(account.id);
      throw resetInvalid();
    }
    return this.finish(record, newPassword, locale);
  }

  private async finish(record: ResetRecord, newPassword: string, locale: Locale): Promise<AccountRecord> {
    let account: AccountRecord;
    try {
      account = await this.auth.resetPassword(record.userId, newPassword);
    } catch (e) {
      // The password did not change: the link / code keeps working until it expires - unless the
      // account is gone (deleted meanwhile), whose resets must not come back.
      if (this.auth.accounts.findById(record.userId)) this.auth.resets.restore(record);
      throw e;
    }
    if (!this.mail.ready()) return account;
    const changed = account;
    const at = this.now().toISOString();
    // The current address, and the previous one when the address was changed recently: if someone
    // else changed the address to take the account over, its real owner still hears about it.
    const recipients = [changed.email, recentPreviousEmail(changed, this.now())].filter((a): a is string => !!a);
    if (!recipients.length) return account;
    this.background('A "password changed" notice', async () => {
      const lang = this.auth.accountLocale(changed) ?? locale;
      // One e-mail per address, so neither address is shown to the other.
      for (const to of recipients) {
        await this.mail.send(passwordChangedEmail(lang, { to, firstName: changed.firstName, username: changed.username, at }));
      }
    });
    return account;
  }

  /**
   * After the e-mail address of an account changed (PUT /api/auth/profile): a short notice to the
   * PREVIOUS address, in the account's language, so its owner learns that password-reset e-mails
   * now go elsewhere. Nothing is sent while mail is not set up or when there was no address.
   */
  notifyEmailChanged(account: AccountRecord, previousEmail: string, locale: Locale): void {
    if (!previousEmail || !this.mail.ready()) return;
    const at = this.now().toISOString();
    this.background('An "e-mail address changed" notice', async () => {
      const lang = this.auth.accountLocale(account) ?? locale;
      await this.mail.send(emailChangedEmail(lang, { to: previousEmail, firstName: account.firstName, username: account.username, at }));
    });
  }
}
