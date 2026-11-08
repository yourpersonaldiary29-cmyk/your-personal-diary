/**
 * Remote access orchestration: turns the owner's settings into a reachable, encrypted address.
 *
 * Steps of a run (each reported as a localised status step, see RemoteStatus):
 *   1. duckdns      point <hostname> at this network's public IP (DuckDNS update)
 *   2. certificate  reuse the stored Let's Encrypt certificate while it has >= 30 days left,
 *                   otherwise obtain one through ACME dns-01 (TXT record via DuckDNS)
 *   3. listener     HTTPS on 0.0.0.0:<publicPort> (8443 when that port cannot be opened);
 *                   a renewed certificate is hot-reloaded
 *   4. upnp         ask the router to forward <publicPort>/TCP to this computer (optional; on
 *                   failure the status explains the manual port forwarding)
 *
 * While enabled: the DuckDNS address is refreshed every 5 minutes, the certificate is checked
 * daily (renewal below 30 days), the router mapping is refreshed hourly, and a failed run is
 * retried with a growing delay. Turning remote access off closes the HTTPS listener and removes
 * the router mapping. The DuckDNS token never reaches a log line, a status or an error text.
 *
 * This is the only part of the server that opens outbound connections, and only while remote
 * access is on (or while the owner runs "Test connection").
 */
import type http from 'node:http';
import net from 'node:net';
import { APP_NAME } from '@shared/constants';
import type {
  RemoteAccessSettings,
  RemoteCheck,
  RemoteMessage,
  RemoteStatus,
  RemoteStep,
  RemoteStepId,
  RemoteStepState,
  RemoteTestResult,
} from '@shared/types';
import type { ServerConfig } from '../config';
import type { HostPolicy } from '../middleware/host-check';
import { ApiError } from '../errors';
import { settingsOwner, UNREADABLE_OWNER } from '../security/owner';
import { LETS_ENCRYPT_PRODUCTION, LETS_ENCRYPT_STAGING, obtainCertificate } from './acme';
import { resolveHostIpv4, waitForTxtRecord } from './dns-check';
import * as duckdns from './duckdns';
import { CancelledError, errorDetail, errorText, isCancelled, redact, RemoteError, type RemoteParams } from './errors';
import { applyRemoteUpdate, readRemoteConfig, REMOTE_DEFAULTS, toPublicSettings, writeRemoteConfig, type RemoteConfig } from './settings';
import { DEFAULT_FALLBACK_TLS_PORT, startTlsListener, type TlsListener } from './tls';
import {
  certificateInfo,
  deleteTlsFiles,
  isUsable,
  loadCertificate,
  loadOrCreateAccountKey,
  saveCertificate,
  tlsPaths,
  type StoredCertificate,
  type TlsPaths,
} from './tls-store';
import * as upnp from './upnp';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const STEP_ORDER: readonly RemoteStepId[] = ['duckdns', 'certificate', 'listener', 'upnp'];
/** Delays between automatic retries after a failed run (the last one repeats). */
export const DEFAULT_RETRY_DELAYS_MS = [2 * MINUTE, 10 * MINUTE, 30 * MINUTE, HOUR, 3 * HOUR, 6 * HOUR];

export interface RemoteManagerOptions {
  /** ACME directory override (tests: the mock server). Default: Let's Encrypt production / staging. */
  directoryUrl?: string;
  /** DuckDNS base URL override (tests). */
  duckdnsBaseUrl?: string;
  /** SSDP / UPnP options (tests: a mock responder on 127.0.0.1). */
  upnp?: upnp.UpnpOptions;
  /** DNS propagation check of the dns-01 TXT record (default: the DuckDNS name servers, 2 minutes). */
  waitForTxt?: (name: string, value: string, signal?: AbortSignal) => Promise<boolean>;
  /** A-record lookup used by "Test connection" (default: the system resolver). */
  resolveHost?: (hostname: string) => Promise<string[]>;
  /** ACME poll interval (default 2 s). */
  acmePollMs?: number;
  /** Local port of the HTTPS listener (default: publicPort; tests: 0 = any free port). */
  tlsPort?: number;
  /** Fallback when the port cannot be opened (default 8443; null = none). */
  fallbackTlsPort?: number | null;
  /** Interface of the HTTPS listener (default 0.0.0.0; tests: 127.0.0.1). */
  tlsHost?: string;
  ipUpdateIntervalMs?: number;
  renewCheckIntervalMs?: number;
  upnpRefreshIntervalMs?: number;
  retryDelaysMs?: number[];
  /** Renew when fewer days are left (default 30). */
  renewBeforeDays?: number;
  /** This computer's LAN addresses (default: the network interfaces, private first). */
  lanIps?: () => string[];
  now?: () => Date;
  /** Human-readable log line (default: stderr, which the desktop shell appends to server.log). */
  log?: (line: string) => void;
  /** Lifecycle event (the JSON lines on stdout). */
  emit?: (event: string, data: Record<string, unknown>) => void;
}

export interface RemoteManagerDeps {
  config: ServerConfig;
  /** The device key (encrypts the DuckDNS token in server-settings.json). */
  deviceKey: Buffer;
  /**
   * Id of the first account created on this computer ('' while there is none; security/owner.ts
   * `firstAccountId`): the owner of remote access while the settings store no owner.
   */
  firstAccountId: () => string;
  /** Request handler the HTTPS listener serves (the app behind the host check). */
  handler: http.RequestListener;
  options?: RemoteManagerOptions;
}

/** 100.64.0.0/10 (carrier-grade NAT) or a private range: a "public" address that is not reachable from the internet. */
export function isUnreachableFromInternet(ip: string): boolean {
  if (!net.isIPv4(ip)) return false;
  const [a, b] = ip.split('.').map(Number);
  return upnp.isPrivateIpv4(ip) || (a === 100 && b >= 64 && b <= 127);
}

interface Run {
  gen: number;
  abort: AbortController;
  done: Promise<void>;
}

export class RemoteManager {
  private cfg: RemoteConfig;
  private readonly opts: RemoteManagerOptions;
  private readonly paths: TlsPaths;
  private readonly steps = new Map<RemoteStepId, RemoteStep>();
  private publicIp: string | null = null;
  private cert: StoredCertificate | null;
  private listener: TlsListener | null = null;
  private mapping: { gw: upnp.Gateway; externalPort: number; internalPort: number } | null = null;
  private lastError: RemoteMessage | null = null;
  private nextRetryAt: Date | null = null;
  private retryIndex = 0;
  private run: Run | null = null;
  private gen = 0;
  private timers: NodeJS.Timeout[] = [];
  /** Work started by the timers (IP update, router refresh), awaited before turning off. */
  private readonly background = new Set<Promise<void>>();
  /** Aborted with the timers, so their work stops before the listener and mapping are removed. */
  private backgroundAbort = new AbortController();
  private stopped = false;
  /** Tail of the update / releaseOwner chain (see `exclusive`). */
  private ops: Promise<void> = Promise.resolve();

  constructor(private readonly deps: RemoteManagerDeps) {
    this.opts = deps.options ?? {};
    this.cfg = readRemoteConfig(deps.config, deps.deviceKey);
    this.paths = tlsPaths(deps.config.dataDir);
    this.cert = loadCertificate(this.paths);
    this.resetSteps();
  }

  // Helpers ---------------------------------------------------------------------------------------

  private now(): Date {
    return this.opts.now ? this.opts.now() : new Date();
  }

  private log(line: string): void {
    const text = redact(line, [this.cfg.duckdnsToken]);
    if (this.opts.log) this.opts.log(text);
    else console.error(`[diary-server] ${text}`);
  }

  private emit(event: string, data: Record<string, unknown>): void {
    this.opts.emit?.(event, data);
  }

  private lanIps(): string[] {
    return this.opts.lanIps ? this.opts.lanIps() : upnp.lanIpv4Addresses();
  }

  private resetSteps(): void {
    for (const id of STEP_ORDER) this.steps.set(id, { id, state: 'idle', messageKey: `server.remote.step.${id}.idle`, params: {}, at: null });
  }

  private setStep(id: RemoteStepId, state: RemoteStepState, messageKey: string, params: RemoteParams = {}): void {
    this.steps.set(id, { id, state, messageKey, params, at: this.now().toISOString() });
  }

  private fail(id: RemoteStepId, err: RemoteError): void {
    this.setStep(id, 'error', err.key, err.params);
    this.lastError = { messageKey: err.key, params: err.params };
  }

  private urlOf(c: RemoteConfig = this.cfg): string {
    return `https://${c.hostname}${c.publicPort === 443 ? '' : `:${c.publicPort}`}`;
  }

  private directoryUrl(c: RemoteConfig): string {
    return this.opts.directoryUrl ?? (c.staging ? LETS_ENCRYPT_STAGING : LETS_ENCRYPT_PRODUCTION);
  }

  private clearTimers(): void {
    for (const t of this.timers.splice(0)) {
      clearTimeout(t);
      clearInterval(t);
    }
    this.backgroundAbort.abort();
    this.backgroundAbort = new AbortController();
  }

  /** Runs timer work in the background; it is aborted by clearTimers and awaited by settleBackground. */
  private spawn(work: (signal: AbortSignal) => Promise<unknown>): void {
    const signal = this.backgroundAbort.signal;
    const p: Promise<void> = work(signal)
      .then(
        () => {},
        () => {},
      )
      .finally(() => this.background.delete(p));
    this.background.add(p);
  }

  private async settleBackground(): Promise<void> {
    while (this.background.size) await Promise.all([...this.background]);
  }

  /**
   * Runs `fn` once every update / releaseOwner called before it has finished, in call order.
   * Without this, an owner release still closing the listener or removing the router mapping
   * could - when it ends - overwrite the settings another account saved meanwhile (that owner and
   * token would then exist only in the file, and a third account could claim remote access), and
   * turning remote access off and on again quickly could close the new listener.
   */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.ops.then(fn);
    this.ops = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /**
   * The HTTPS listener never serves an expired certificate: it is closed (and the certificate step
   * says why) until a run obtains a new one. Returns true when it closed the listener.
   */
  private async closeIfExpired(): Promise<boolean> {
    if (!this.listener) return false;
    const now = this.now();
    if (this.cert && this.cert.validTo.getTime() > now.getTime()) return false;
    await this.closeListener();
    this.setStep('listener', 'idle', 'server.remote.step.listener.idle');
    const err = new RemoteError('server.remote.step.certificate.expired', { date: this.cert ? this.cert.validTo.toISOString().slice(0, 10) : '' });
    this.fail('certificate', err);
    this.log('Remote access: the certificate has expired - HTTPS is closed until a new certificate is issued.');
    return true;
  }

  // Read side -------------------------------------------------------------------------------------

  settings(): RemoteAccessSettings {
    return toPublicSettings(this.cfg);
  }

  /**
   * The owner stored in server-settings.json: the account that saved the settings ('' while none is
   * stored - then the first account created on this computer owns remote access, see `owner()`).
   */
  ownerId(): string {
    return this.cfg.ownerUserId;
  }

  /** The account that owns remote access now: the stored owner, otherwise the first account ('' when there is none). */
  owner(): string {
    return settingsOwner(this.cfg.ownerUserId, this.deps.firstAccountId());
  }

  /** Anything of a setup exists (a changed setting, a token, a certificate) - i.e. a release would clear something. */
  private hasSetup(c: RemoteConfig = this.cfg): boolean {
    return (
      c.enabled !== REMOTE_DEFAULTS.enabled ||
      c.hostname !== REMOTE_DEFAULTS.hostname ||
      c.duckdnsToken !== REMOTE_DEFAULTS.duckdnsToken ||
      c.publicPort !== REMOTE_DEFAULTS.publicPort ||
      c.upnp !== REMOTE_DEFAULTS.upnp ||
      c.staging !== REMOTE_DEFAULTS.staging ||
      this.cert !== null
    );
  }

  /**
   * Startup, after an owner whose account is gone was released (server.ts):
   *   - a stored owner that is not the first account (settings saved before the owner became "the
   *     first account") is kept - never transferred silently - and one log line says so;
   *   - settings present without a stored owner (written before owners were stored) are given to
   *     the first account now (`pinOwner`), so deleting that account later clears them before the
   *     next account takes over.
   * Runs after any save / release in progress (see `exclusive`).
   */
  checkOwner(): Promise<void> {
    return this.exclusive(async () => {
      const first = this.deps.firstAccountId();
      const stored = this.cfg.ownerUserId;
      if (first && stored && stored !== first) {
        this.log('Remote access: kept its existing owner (the account that set it up), which is not the first account on this computer - only that account can view or change it until it is deleted.');
      } else {
        this.pin();
      }
    });
  }

  /**
   * Settings without a stored owner that have something set up (written before owners were stored)
   * are written down as the first account's - `releaseOwner` clears only a stored owner's settings,
   * so without this, deleting the first account would hand them, uncleared, to the next-oldest
   * account. The server calls it at startup (`checkOwner`), right after an account is registered
   * (the first account may be created after the start) and right before an account is deleted.
   * Nothing happens while there is no account, when an owner is stored, or when nothing is set up.
   * Resolves to true when it wrote the owner. Runs after any save / release in progress.
   */
  pinOwner(): Promise<boolean> {
    // Nothing to do in the usual case: no need to wait behind a release closing the router port.
    if (this.cfg.ownerUserId || !this.hasSetup()) return Promise.resolve(false);
    return this.exclusive(async () => this.pin());
  }

  private pin(): boolean {
    const first = this.deps.firstAccountId();
    if (!first || this.cfg.ownerUserId || !this.hasSetup()) return false;
    const next: RemoteConfig = { ...this.cfg, ownerUserId: first };
    writeRemoteConfig(this.deps.config, this.deps.deviceKey, next);
    this.cfg = next;
    this.log('Remote access: settings without an owner now belong to the first account on this computer.');
    return true;
  }

  hostPolicy(): HostPolicy {
    return { enabled: this.cfg.enabled, hostname: this.cfg.hostname };
  }

  /** For GET /api/server/info: on + listening, and the address. */
  info(): { enabled: boolean; url: string } {
    const on = this.cfg.enabled && this.listener !== null;
    return { enabled: on, url: on ? this.urlOf() : '' };
  }

  status(): RemoteStatus {
    const now = this.now();
    const cert = this.cert && this.cert.meta.hostname === this.cfg.hostname ? certificateInfo(this.cert, now) : null;
    return {
      ...toPublicSettings(this.cfg),
      publicIp: this.publicIp,
      certificate: cert,
      steps: STEP_ORDER.map((id) => ({ ...(this.steps.get(id) as RemoteStep), params: { ...(this.steps.get(id) as RemoteStep).params } })),
      lastError: this.lastError ? { messageKey: this.lastError.messageKey, params: { ...this.lastError.params } } : null,
      urls: this.cfg.enabled && this.listener ? [this.urlOf()] : [],
      tlsPort: this.listener ? this.listener.port : null,
      lanIps: this.lanIps(),
      nextRetryAt: this.nextRetryAt ? this.nextRetryAt.toISOString() : null,
      busy: this.run !== null,
      hasOwner: this.owner() !== '',
    };
  }

  // Commands --------------------------------------------------------------------------------------

  /**
   * PUT /api/server/remote: validates, saves, and starts / stops the steps. `actorId` is the
   * signed-in account (the route has already checked its password). Only the owner may save - the
   * stored owner, or while none is stored the first account created on this computer - and the
   * owner is checked again here, right before the save: any other account is refused with 403
   * 'server.remote.notOwner', also one whose request passed the route's gate just before the owner
   * changed. The saver is stored as the owner. Saves and owner releases run one at a time, so a
   * release cannot undo a save made meanwhile, and a stored owner whose account is gone keeps its
   * settings (nobody else can save over them) until it has been released.
   */
  update(body: unknown, actorId: string): Promise<RemoteStatus> {
    return this.exclusive(() => this.applyUpdate(body, actorId));
  }

  private async applyUpdate(body: unknown, actorId: string): Promise<RemoteStatus> {
    if (this.stopped) throw ApiError.forbidden('server.remote.unavailable');
    const prev = this.cfg;
    if (!actorId || this.owner() !== actorId) throw ApiError.forbidden('server.remote.notOwner');
    const next = applyRemoteUpdate(body, prev);
    next.ownerUserId = actorId;
    writeRemoteConfig(this.deps.config, this.deps.deviceKey, next);
    this.cfg = next;
    if (!prev.ownerUserId) this.log('Remote access: settings saved by the owner of this computer - only that account can view or change them.');
    if (!next.enabled) {
      if (prev.enabled || this.listener || this.run || this.mapping) await this.deactivate();
    } else {
      const changed =
        !prev.enabled ||
        prev.hostname !== next.hostname ||
        prev.duckdnsToken !== next.duckdnsToken ||
        prev.publicPort !== next.publicPort ||
        prev.upnp !== next.upnp ||
        prev.staging !== next.staging;
      if (!prev.enabled) this.banner();
      if (changed || (!this.run && this.lastError)) {
        this.retryIndex = 0;
        this.startRun(false);
      }
    }
    return this.status();
  }

  /** POST /api/server/remote/renew: a new certificate now (runs every step again). */
  async renew(): Promise<RemoteStatus> {
    if (!this.cfg.enabled) throw ApiError.validation('server.remote.notEnabled');
    this.retryIndex = 0;
    this.startRun(true);
    return this.status();
  }

  /**
   * The owner account was deleted (or no longer exists): remote access is turned off - HTTPS
   * closed, router mapping removed - and everything of that setup is forgotten: the owner, the
   * saved DuckDNS token, the name, port and router choices (back to the defaults), the public IP,
   * and the certificate with its keys (`<dataDir>/tls/`). Only then does the next owner - the
   * first (oldest) remaining account - get access, and it sets remote access up from scratch, with
   * its own name, token and certificate. Runs after any save in progress (see `exclusive`). Returns
   * false and changes nothing when `userId` is not the stored owner.
   */
  releaseOwner(userId: string): Promise<boolean> {
    return this.exclusive(() => this.release(userId));
  }

  private async release(userId: string): Promise<boolean> {
    if (!userId || this.cfg.ownerUserId !== userId) return false;
    const prev = this.cfg;
    const released: RemoteConfig = { ...REMOTE_DEFAULTS };
    // Saved first, so remote access stays off even if the server stops while the listener closes.
    writeRemoteConfig(this.deps.config, this.deps.deviceKey, released);
    // Off in memory at once (timers and retries check it); the token stays until the work has
    // stopped, so any late log line of the cancelled run is still redacted.
    this.cfg = { ...prev, enabled: false };
    if (prev.enabled || this.listener || this.run || this.mapping) await this.deactivate();
    this.cfg = released;
    this.cert = null;
    this.publicIp = null;
    this.resetSteps();
    this.lastError = null;
    this.nextRetryAt = null;
    if (!deleteTlsFiles(this.paths)) this.log('Remote access: some certificate files of the deleted account could not be removed.');
    if (userId === UNREADABLE_OWNER) {
      this.log('Remote access: the owner stored in server-settings.json is not a valid account id - remote access is off; its DuckDNS token, name and certificate were removed.');
    } else {
      this.log('Remote access: the account that set it up was deleted - remote access is off; its DuckDNS token, name and certificate were removed.');
    }
    return true;
  }

  /** Startup: resume remote access when it was on. Returns at once; the steps run in the background. */
  resume(): void {
    if (!this.cfg.enabled || this.stopped) return;
    this.banner();
    this.startRun(false);
  }

  /**
   * Server shutdown: stop the work and the HTTPS listener, and ask the router to close the port
   * (best effort, at most 2 s - the next start opens it again). Remote access stays on in the
   * settings and resumes on the next start.
   */
  async shutdown(): Promise<void> {
    this.stopped = true;
    this.clearTimers();
    const run = this.run;
    this.gen++;
    if (run) {
      run.abort.abort();
      await run.done.catch(() => {});
    }
    this.run = null;
    await this.settleBackground();
    await this.closeListener();
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      this.removeMapping(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 2000);
        timer.unref?.();
      }),
    ]);
    clearTimeout(timer);
  }

  /** Waits until the current run (if any) has finished - tests and diagnostics. */
  async idle(): Promise<void> {
    while (this.run) await this.run.done.catch(() => {});
  }

  private banner(): void {
    const line = '='.repeat(64);
    this.log(line);
    this.log(`REMOTE ACCESS IS ON: ${this.urlOf()} (public port ${this.cfg.publicPort}${this.cfg.staging ? ', Let\'s Encrypt staging' : ''})`);
    this.log('The diary accepts connections from the internet. Outbound connections while it is on: DuckDNS and Let\'s Encrypt only.');
    this.log(line);
    this.emit('remote', { enabled: true, hostname: this.cfg.hostname, publicPort: this.cfg.publicPort });
  }

  private async deactivate(): Promise<void> {
    this.clearTimers();
    const run = this.run;
    this.gen++;
    if (run) {
      run.abort.abort();
      await run.done.catch(() => {});
    }
    this.run = null;
    // A router refresh started by a timer may be adding the mapping right now: let it finish
    // (it was aborted) so the mapping it recorded is removed below.
    await this.settleBackground();
    await this.closeListener();
    await this.removeMapping();
    this.resetSteps();
    this.lastError = null;
    this.nextRetryAt = null;
    this.retryIndex = 0;
    this.log('Remote access is OFF: the HTTPS listener is closed.');
    this.emit('remote', { enabled: false });
  }

  private async closeListener(): Promise<void> {
    const l = this.listener;
    this.listener = null;
    if (l) await l.close();
  }

  private async removeMapping(): Promise<void> {
    const m = this.mapping;
    this.mapping = null;
    if (!m) return;
    try {
      await upnp.deletePortMapping(m.gw, m.externalPort);
    } catch (e) {
      this.log(`The router port mapping could not be removed: ${errorText(e)}`);
    }
  }

  // Runs ------------------------------------------------------------------------------------------

  private startRun(forceRenew: boolean): void {
    if (this.stopped) return;
    const previous = this.run;
    previous?.abort.abort();
    this.clearTimers();
    this.nextRetryAt = null;
    const gen = ++this.gen;
    const abort = new AbortController();
    const run: Run = { gen, abort, done: Promise.resolve() };
    this.run = run;
    run.done = (async () => {
      if (previous) await previous.done.catch(() => {});
      if (gen !== this.gen) return;
      try {
        await this.pipeline(gen, abort.signal, forceRenew);
      } catch (e) {
        if (!isCancelled(e)) this.log(`Remote access: unexpected error: ${errorText(e, [this.cfg.duckdnsToken])}`);
      } finally {
        if (this.run === run) this.run = null;
      }
    })();
  }

  private scheduleRetry(gen: number): void {
    const delays = this.opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    const delay = delays[Math.min(this.retryIndex, delays.length - 1)];
    this.retryIndex++;
    this.nextRetryAt = new Date(this.now().getTime() + delay);
    const t = setTimeout(() => {
      if (gen === this.gen && !this.stopped && this.cfg.enabled) this.startRun(false);
    }, delay);
    t.unref?.();
    this.timers.push(t);
  }

  private startTimers(gen: number): void {
    const every = (ms: number, fn: () => void) => {
      const t = setInterval(() => {
        if (gen !== this.gen || this.stopped || !this.cfg.enabled || this.run) return;
        fn();
      }, ms);
      t.unref?.();
      this.timers.push(t);
    };
    every(this.opts.ipUpdateIntervalMs ?? 5 * MINUTE, () => {
      this.spawn(async (signal) => {
        // Also the expiry watchdog: an expired certificate closes HTTPS at once and starts a run.
        if (await this.closeIfExpired()) {
          if (gen === this.gen && !this.stopped && this.cfg.enabled) this.startRun(false);
          return;
        }
        await this.updateDuckDns(this.cfg, signal);
      });
    });
    every(this.opts.renewCheckIntervalMs ?? 24 * HOUR, () => {
      if (!isUsable(this.cert, this.cfg.hostname, this.cfg.staging, this.now(), this.opts.renewBeforeDays ?? 30)) this.startRun(false);
    });
    every(this.opts.upnpRefreshIntervalMs ?? HOUR, () => {
      if (this.cfg.upnp && this.listener) this.spawn((signal) => this.refreshUpnp(this.cfg, signal));
    });
  }

  private async pipeline(gen: number, signal: AbortSignal, forceRenew: boolean): Promise<void> {
    const cfg = this.cfg;
    const alive = () => {
      if (signal.aborted || gen !== this.gen) throw new CancelledError();
    };
    // Even when DuckDNS cannot be reached below, an expired certificate is not served meanwhile.
    await this.closeIfExpired();
    alive();

    // 1. DuckDNS ----------------------------------------------------------------------------------
    if (!(await this.updateDuckDns(cfg, signal))) {
      alive();
      this.scheduleRetry(gen);
      return;
    }
    alive();

    // 2. Certificate ------------------------------------------------------------------------------
    const minDays = this.opts.renewBeforeDays ?? 30;
    const stored = loadCertificate(this.paths);
    let retryLater = false;
    if (!forceRenew && isUsable(stored, cfg.hostname, cfg.staging, this.now(), minDays)) {
      this.cert = stored;
      this.setCertificateOk();
    } else {
      this.setStep('certificate', 'running', 'server.remote.step.certificate.checking');
      try {
        const directoryUrl = this.directoryUrl(cfg);
        const obtained = await obtainCertificate({
          directoryUrl,
          hostname: cfg.hostname,
          accountKey: loadOrCreateAccountKey(this.paths),
          signal,
          pollIntervalMs: this.opts.acmePollMs,
          onProgress: (key, params) => {
            if (gen === this.gen) this.setStep('certificate', 'running', key, params ?? {});
          },
          setTxt: async (value) => {
            const r = await duckdns.setTxt(cfg.hostname, cfg.duckdnsToken, value, { baseUrl: this.opts.duckdnsBaseUrl, signal });
            if (!r.ok) throw new RemoteError('server.remote.step.certificate.txtFailed');
          },
          clearTxt: async () => {
            await duckdns.clearTxt(cfg.hostname, cfg.duckdnsToken, { baseUrl: this.opts.duckdnsBaseUrl, timeoutMs: 10_000 });
          },
          waitForTxt: this.opts.waitForTxt ?? ((name, value, s) => waitForTxtRecord(name, value, { signal: s })),
        });
        alive();
        saveCertificate(this.paths, obtained.keyPem, obtained.certPem, {
          hostname: cfg.hostname,
          staging: cfg.staging,
          directoryUrl,
          obtainedAt: this.now().toISOString(),
        });
        this.cert = loadCertificate(this.paths);
        if (!this.cert) throw new RemoteError('server.remote.step.certificate.rejected', { detail: 'the saved certificate could not be read back' });
        this.setCertificateOk();
        this.log(`Remote access: new certificate for ${cfg.hostname}, valid until ${this.cert.validTo.toISOString()}.`);
      } catch (e) {
        if (isCancelled(e)) throw e;
        alive();
        const err = e instanceof RemoteError ? e : new RemoteError('server.remote.step.certificate.unreachable', errorDetail(e, [cfg.duckdnsToken]));
        this.fail('certificate', err);
        this.log(`Remote access: certificate request failed (${err.key}${err.params.detail ? `: ${err.params.detail}` : ''}).`);
        // A still-valid certificate for the same name keeps the address working meanwhile.
        if (!isUsable(stored, cfg.hostname, cfg.staging, this.now(), 0)) {
          if (this.listener) {
            await this.closeListener();
            this.setStep('listener', 'idle', 'server.remote.step.listener.idle');
          }
          this.scheduleRetry(gen);
          return;
        }
        this.cert = stored;
        retryLater = true;
      }
    }
    const cert = this.cert as StoredCertificate;

    // 3. HTTPS listener ---------------------------------------------------------------------------
    const wanted = this.opts.tlsPort ?? cfg.publicPort;
    try {
      if (this.listener && this.listener.requestedPort === wanted) {
        this.listener.reload(cert);
      } else {
        await this.closeListener();
        this.listener = await startTlsListener(this.deps.handler, cert, {
          port: wanted,
          fallbackPort: this.opts.fallbackTlsPort === undefined ? DEFAULT_FALLBACK_TLS_PORT : this.opts.fallbackTlsPort,
          host: this.opts.tlsHost ?? '0.0.0.0',
        });
        this.log(`Remote access: HTTPS listening on port ${this.listener.port}.`);
      }
      const port = this.listener.port;
      if (wanted === 0 || port === wanted) this.setStep('listener', 'ok', 'server.remote.step.listener.ok', { port: String(port) });
      else this.setStep('listener', 'ok', 'server.remote.step.listener.okFallback', { wanted: String(wanted), port: String(port) });
    } catch (e) {
      alive();
      this.fail('listener', new RemoteError('server.remote.step.listener.failed', { port: String(wanted), ...errorDetail(e) }));
      this.scheduleRetry(gen);
      return;
    }
    alive();

    // 4. Router port (UPnP) -----------------------------------------------------------------------
    await this.refreshUpnp(cfg, signal);
    alive();

    this.emit('remote', { enabled: true, url: this.urlOf(cfg), tlsPort: this.listener?.port ?? null });
    if (retryLater) {
      this.scheduleRetry(gen);
    } else {
      this.retryIndex = 0;
      this.lastError = null;
    }
    this.startTimers(gen);
  }

  private setCertificateOk(): void {
    if (!this.cert) return;
    const info = certificateInfo(this.cert, this.now());
    const date = info.validTo.slice(0, 10);
    if (info.staging) this.setStep('certificate', 'ok', 'server.remote.step.certificate.okStaging', { date, days: info.daysLeft });
    else this.setStep('certificate', 'ok', 'server.remote.step.certificate.ok', { date, days: info.daysLeft });
  }

  /** DuckDNS update; sets the step. Returns false on failure. Throws CancelledError when aborted. */
  private async updateDuckDns(cfg: RemoteConfig, signal: AbortSignal | undefined): Promise<boolean> {
    const first = this.steps.get('duckdns')?.state !== 'ok';
    if (first) this.setStep('duckdns', 'running', 'server.remote.step.duckdns.running', { hostname: cfg.hostname });
    try {
      const r = await duckdns.updateIp(cfg.hostname, cfg.duckdnsToken, undefined, { baseUrl: this.opts.duckdnsBaseUrl, signal });
      if (!r.ok) {
        this.fail('duckdns', new RemoteError('server.remote.step.duckdns.rejected', { hostname: cfg.hostname }));
        return false;
      }
      if (r.value && net.isIPv4(r.value)) {
        if (this.publicIp && this.publicIp !== r.value) this.log(`Remote access: the public IP changed to ${r.value}.`);
        this.publicIp = r.value;
      }
      if (this.publicIp) this.setStep('duckdns', 'ok', 'server.remote.step.duckdns.ok', { hostname: cfg.hostname, ip: this.publicIp });
      else this.setStep('duckdns', 'ok', 'server.remote.step.duckdns.okNoIp', { hostname: cfg.hostname });
      return true;
    } catch (e) {
      if (isCancelled(e) || signal?.aborted) throw new CancelledError();
      this.fail('duckdns', new RemoteError('server.remote.step.duckdns.failed', errorDetail(e, [cfg.duckdnsToken])));
      return false;
    }
  }

  /** Router mapping publicPort -> the HTTPS listener; sets the step (never throws except when cancelled). */
  private async refreshUpnp(cfg: RemoteConfig, signal: AbortSignal | undefined): Promise<void> {
    const internalPort = this.listener?.port ?? null;
    // Ports go out as strings: numbers would be rendered with digit grouping ('8,443').
    const manual: RemoteParams = { publicPort: String(cfg.publicPort), lanIp: this.lanIps()[0] ?? '', port: String(internalPort ?? cfg.publicPort) };
    if (this.mapping && (!cfg.upnp || this.mapping.externalPort !== cfg.publicPort || this.mapping.internalPort !== internalPort)) {
      await this.removeMapping();
    }
    if (!cfg.upnp) {
      this.setStep('upnp', 'idle', 'server.remote.step.upnp.off', manual);
      return;
    }
    if (internalPort === null) {
      this.setStep('upnp', 'idle', 'server.remote.step.upnp.idle');
      return;
    }
    if (this.steps.get('upnp')?.state !== 'ok') this.setStep('upnp', 'running', 'server.remote.step.upnp.running');
    try {
      const gw = await upnp.discoverGateway({ ...this.opts.upnp, signal });
      if (signal?.aborted) throw new CancelledError();
      if (!gw) {
        this.mapping = null;
        this.setStep('upnp', 'error', 'server.remote.step.upnp.notFound', manual);
        return;
      }
      manual.lanIp = gw.localAddress;
      await upnp.ensurePortMapping(
        gw,
        { externalPort: cfg.publicPort, internalPort, internalClient: gw.localAddress, description: APP_NAME, leaseSeconds: 0 },
        signal,
      );
      this.mapping = { gw, externalPort: cfg.publicPort, internalPort };
      const external = await upnp.getExternalIp(gw, signal).catch(() => null);
      if (external && isUnreachableFromInternet(external)) {
        this.setStep('upnp', 'error', 'server.remote.step.upnp.cgnat', { ip: external });
        return;
      }
      if (external && !this.publicIp) this.publicIp = external;
      this.setStep('upnp', 'ok', 'server.remote.step.upnp.ok', { publicPort: String(cfg.publicPort), lanIp: gw.localAddress, port: String(internalPort) });
    } catch (e) {
      if (isCancelled(e) || signal?.aborted) throw new CancelledError();
      if (e instanceof upnp.UpnpError && e.code === 718) {
        this.setStep('upnp', 'error', 'server.remote.step.upnp.conflict', { ...manual, client: e.message });
      } else {
        this.setStep('upnp', 'error', 'server.remote.step.upnp.failed', { ...manual, ...errorDetail(e) });
      }
    }
  }

  // Test connection -------------------------------------------------------------------------------

  /**
   * POST /api/server/remote/test: DuckDNS update + UPnP discovery + DNS lookup of the name (+ the
   * HTTPS listener state). `body` may carry a hostname / token / upnp to test before saving them.
   */
  async test(body?: unknown): Promise<RemoteTestResult> {
    let cfg = this.cfg;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const b = body as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const k of ['hostname', 'duckdnsToken', 'upnp'] as const) if (b[k] !== undefined) patch[k] = b[k];
      if (patch.duckdnsToken === '') delete patch.duckdnsToken;
      cfg = applyRemoteUpdate(patch, { ...this.cfg, enabled: false });
    }
    if (!cfg.hostname) throw ApiError.validation('server.remote.hostnameRequired', 'hostname');
    if (!cfg.duckdnsToken) throw ApiError.validation('server.remote.tokenRequired', 'duckdnsToken');
    const checks: RemoteCheck[] = [];

    let ip: string | null = null;
    try {
      const r = await duckdns.updateIp(cfg.hostname, cfg.duckdnsToken, undefined, { baseUrl: this.opts.duckdnsBaseUrl });
      if (r.ok) {
        ip = r.value && net.isIPv4(r.value) ? r.value : null;
        if (ip) this.publicIp = ip;
        checks.push(
          ip
            ? { id: 'duckdns', state: 'ok', messageKey: 'server.remote.test.duckdns.ok', params: { hostname: cfg.hostname, ip } }
            : { id: 'duckdns', state: 'ok', messageKey: 'server.remote.test.duckdns.okNoIp', params: { hostname: cfg.hostname } },
        );
      } else {
        checks.push({ id: 'duckdns', state: 'error', messageKey: 'server.remote.test.duckdns.rejected', params: { hostname: cfg.hostname } });
      }
    } catch (e) {
      checks.push({ id: 'duckdns', state: 'error', messageKey: 'server.remote.test.duckdns.failed', params: errorDetail(e, [cfg.duckdnsToken]) });
    }

    const [upnpCheck, dnsCheck] = await Promise.all([this.testUpnp(cfg), this.testDns(cfg, ip ?? this.publicIp)]);
    checks.push(upnpCheck, dnsCheck);

    if (this.listener && this.cfg.enabled) {
      checks.push({ id: 'https', state: 'ok', messageKey: 'server.remote.test.https.ok', params: { port: String(this.listener.port) } });
    } else if (this.cfg.enabled) {
      checks.push({ id: 'https', state: 'warning', messageKey: 'server.remote.test.https.notListening', params: {} });
    } else {
      checks.push({ id: 'https', state: 'skipped', messageKey: 'server.remote.test.https.off', params: {} });
    }
    return { checks, publicIp: ip ?? this.publicIp, at: this.now().toISOString() };
  }

  private async testUpnp(cfg: RemoteConfig): Promise<RemoteCheck> {
    if (!cfg.upnp) return { id: 'upnp', state: 'skipped', messageKey: 'server.remote.test.upnp.off', params: {} };
    try {
      const gw = await upnp.discoverGateway(this.opts.upnp);
      if (!gw) return { id: 'upnp', state: 'warning', messageKey: 'server.remote.test.upnp.notFound', params: {} };
      const external = await upnp.getExternalIp(gw).catch(() => null);
      if (external && isUnreachableFromInternet(external)) {
        return { id: 'upnp', state: 'warning', messageKey: 'server.remote.test.upnp.cgnat', params: { ip: external } };
      }
      return external
        ? { id: 'upnp', state: 'ok', messageKey: 'server.remote.test.upnp.ok', params: { ip: external } }
        : { id: 'upnp', state: 'ok', messageKey: 'server.remote.test.upnp.okNoIp', params: {} };
    } catch (e) {
      return { id: 'upnp', state: 'warning', messageKey: 'server.remote.test.upnp.failed', params: errorDetail(e) };
    }
  }

  private async testDns(cfg: RemoteConfig, publicIp: string | null): Promise<RemoteCheck> {
    try {
      const resolved = await (this.opts.resolveHost ?? resolveHostIpv4)(cfg.hostname);
      const list = resolved.join(', ');
      if (!publicIp) return { id: 'dns', state: 'ok', messageKey: 'server.remote.test.dns.resolved', params: { hostname: cfg.hostname, resolved: list } };
      if (resolved.includes(publicIp)) return { id: 'dns', state: 'ok', messageKey: 'server.remote.test.dns.ok', params: { hostname: cfg.hostname, ip: publicIp } };
      return { id: 'dns', state: 'warning', messageKey: 'server.remote.test.dns.mismatch', params: { hostname: cfg.hostname, resolved: list, ip: publicIp } };
    } catch (e) {
      return { id: 'dns', state: 'error', messageKey: 'server.remote.test.dns.failed', params: { hostname: cfg.hostname, ...errorDetail(e) } };
    }
  }
}
