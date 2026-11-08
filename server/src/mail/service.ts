/**
 * Sending e-mail (password reset): the owner's SMTP settings + delivery.
 *
 * Owner-only, exactly like remote access (security/owner.ts): the settings belong to the owner of
 * this computer - the stored owner (the account that saved them), or while none is stored the first
 * account created on this computer - from the start, before anything is configured. Every other
 * account gets 403 'server.mail.notOwner', also when it tries to save first. Deleting the owner
 * account turns mail off and forgets the settings; only then does the next-oldest account own them.
 *
 * Mail is sent only while it is enabled and complete, only to the configured SMTP host, and never
 * logs or returns the SMTP password.
 *
 * The SMTP conversation itself is done by the injected `SmtpTransport` (mail/transport.ts): the
 * node:net / node:tls client on the desktop (mail/node-transport.ts, passed in by server.ts), a
 * native plugin on Android. This module - like the routes that use it - imports no socket code.
 */
import type { Locale } from '@shared/i18n';
import type { MailSettingsView } from '@shared/types';
import type { ServerConfig } from '../config';
import { ApiError } from '../errors';
import { settingsOwner, UNREADABLE_OWNER } from '../security/owner';
import { MAIL_NOT_CONFIGURED_KEY, SmtpError } from './errors';
import { buildMessage, type MailContent } from './mime';
import {
  applyMailUpdate,
  effectiveFrom,
  hasMailSetup,
  isMailReady,
  MAIL_DEFAULTS,
  readMailConfig,
  toMailView,
  writeMailConfig,
  type MailConfig,
} from './settings';
import { testEmail } from './templates';
import { assertSafeAddress, type SmtpOptions, type SmtpTransport } from './transport';

export interface MailServiceOptions {
  /** SMTP overrides for tests: trusted CA of the mock server, TCP target, shorter timeout. */
  smtp?: Pick<SmtpOptions, 'ca' | 'connectHost' | 'timeoutMs'>;
  now?: () => Date;
  /** Human-readable log line (default: stderr, which the desktop shell appends to server.log). */
  log?: (line: string) => void;
}

export interface MailServiceDeps {
  config: ServerConfig;
  /** Encrypts the SMTP password in server-settings.json. */
  deviceKey: Buffer;
  /**
   * Id of the first account created on this computer ('' while there is none; security/owner.ts
   * `firstAccountId`): the owner of the mail settings while they store no owner. The server always
   * passes it. Tests that build the service alone may leave it out: then the account that saves
   * first is accepted as the owner at write time (the routes still let only the first account in).
   */
  firstAccountId?: () => string;
  /**
   * Carries out the SMTP conversation (mail/transport.ts). Always injected, so this module never
   * imports socket code: the desktop server passes `nodeSmtpTransport` (mail/node-transport.ts,
   * the default of `startServer`), the Android core its native plugin.
   */
  transport: SmtpTransport;
  options?: MailServiceOptions;
}

export class MailService {
  private cfg: MailConfig;
  private readonly opts: MailServiceOptions;

  constructor(private readonly deps: MailServiceDeps) {
    this.opts = deps.options ?? {};
    this.cfg = readMailConfig(deps.config, deps.deviceKey);
  }

  private now(): Date {
    return this.opts.now ? this.opts.now() : new Date();
  }

  private log(line: string): void {
    if (this.opts.log) this.opts.log(line);
    else console.error(`[diary-server] ${line}`);
  }

  /** The settings as the owner sees them (never the SMTP password). */
  view(): MailSettingsView {
    return { ...toMailView(this.cfg), hasOwner: this.owner() !== '' };
  }

  /**
   * The owner stored in server-settings.json: the account that saved the settings ('' while none is
   * stored - then the first account created on this computer owns them, see `owner()`).
   */
  ownerId(): string {
    return this.cfg.ownerUserId;
  }

  /** The account that owns the mail settings now: the stored owner, otherwise the first account ('' when there is none). */
  owner(): string {
    return settingsOwner(this.cfg.ownerUserId, this.deps.firstAccountId?.() ?? '');
  }

  /**
   * Startup, after an owner whose account is gone was released (server.ts):
   *   - a stored owner that is not the first account (settings saved before the owner became "the
   *     first account") is kept - never transferred silently - and one log line says so;
   *   - settings present without a stored owner (written before owners were stored) are given to
   *     the first account now (`pinOwner`), so deleting that account later clears them before the
   *     next account takes over.
   */
  checkOwner(): void {
    const first = this.deps.firstAccountId?.() ?? '';
    const stored = this.cfg.ownerUserId;
    if (first && stored && stored !== first) {
      this.log('E-mail sending: kept its existing owner (the account that set it up), which is not the first account on this computer - only that account can view or change it until it is deleted.');
    } else {
      this.pinOwner();
    }
  }

  /**
   * Settings without a stored owner that have something set up (written before owners were stored)
   * are written down as the first account's - `releaseOwner` clears only a stored owner's settings,
   * so without this, deleting the first account would hand them, uncleared, to the next-oldest
   * account. The server calls it at startup (`checkOwner`), right after an account is registered
   * (the first account may be created after the start) and right before an account is deleted.
   * Nothing happens while there is no account, when an owner is stored, or when nothing is set up.
   * Returns true when it wrote the owner.
   */
  pinOwner(): boolean {
    const first = this.deps.firstAccountId?.() ?? '';
    if (!first || this.cfg.ownerUserId || !hasMailSetup(this.cfg)) return false;
    const next: MailConfig = { ...this.cfg, ownerUserId: first };
    writeMailConfig(this.deps.config, this.deps.deviceKey, next);
    this.cfg = next;
    this.log('E-mail sending: settings without an owner now belong to the first account on this computer.');
    return true;
  }

  /** True while e-mails can be sent (enabled and complete). */
  ready(): boolean {
    return isMailReady(this.cfg);
  }

  /**
   * Saves a settings patch for `actorId`, who must be the owner (`owner()`); the saver is stored as
   * the owner. The owner is checked again here, at the moment of writing: a request that passed the
   * route's gate and then waited for its password check is refused with 403 'server.mail.notOwner'
   * when the owner changed meanwhile, and a stored owner whose account is gone keeps its settings
   * (nobody else can save over them) until it has been released.
   */
  update(body: unknown, actorId: string): MailSettingsView {
    const owner = this.cfg.ownerUserId || (this.deps.firstAccountId ? this.deps.firstAccountId() : actorId);
    if (!actorId || owner !== actorId) throw ApiError.forbidden('server.mail.notOwner');
    const next = applyMailUpdate(body, this.cfg);
    next.ownerUserId = actorId;
    writeMailConfig(this.deps.config, this.deps.deviceKey, next);
    this.cfg = next;
    return this.view();
  }

  /**
   * The owner account is gone: mail off and every setting forgotten (stored owner included) - only
   * now does the first remaining account own the mail settings. False when `userId` is not the
   * stored owner.
   */
  releaseOwner(userId: string): boolean {
    if (!this.cfg.ownerUserId || this.cfg.ownerUserId !== userId) return false;
    const next: MailConfig = { ...MAIL_DEFAULTS };
    writeMailConfig(this.deps.config, this.deps.deviceKey, next);
    this.cfg = next;
    if (userId === UNREADABLE_OWNER) {
      this.log('E-mail sending: the owner stored in server-settings.json is not a valid account id - sending e-mail is off and its settings were removed.');
    }
    return true;
  }

  /**
   * Delivers one e-mail with the saved settings. Throws SmtpError ('server.mail.error.*', or
   * 'server.mail.notConfigured' while mail is off or incomplete).
   */
  async send(content: MailContent): Promise<void> {
    const c = this.cfg;
    if (!isMailReady(c)) throw new SmtpError(MAIL_NOT_CONFIGURED_KEY);
    const from = effectiveFrom(c);
    let data: string;
    try {
      data = buildMessage(from, content, this.now()).data;
    } catch {
      throw new SmtpError('server.mail.error.address');
    }
    const smtp: SmtpOptions = {
      host: c.host,
      port: c.port,
      security: c.security,
      username: c.username,
      password: c.password,
      ...this.opts.smtp,
    };
    // Checked here for every transport (the node client checks again): an address must never be
    // able to add SMTP commands, whoever carries out the conversation.
    assertSafeAddress(from);
    assertSafeAddress(content.to);
    await this.deps.transport.send(smtp, { from, to: content.to }, data);
  }

  /** Sends the test e-mail to `to` (the owner's own address) in `locale`. */
  async sendTest(to: string, firstName: string, locale: Locale): Promise<void> {
    await this.send(testEmail(locale, { to, firstName, from: effectiveFrom(this.cfg) }));
  }
}
