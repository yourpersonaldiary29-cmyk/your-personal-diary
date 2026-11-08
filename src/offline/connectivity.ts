/**
 * Connectivity (section 4.2): the state machine ONLINE -> SUSPECT -> OFFLINE -> SYNCING -> ONLINE,
 * driven by the request outcomes the api client already reports to src/api/connection.ts
 * (`reportConnectionLost` / `reportServerReached`) plus a probe of `GET /api/health`.
 *
 *  - The data layer switches at the FIRST failure (`suspect`): reads go to the cache, writes go to the
 *    outbox anyway. The UI shows "offline" only after 1.5 s of continuous failure (`offline`,
 *    `showOffline`) or after a failed probe - a blip that recovers within 1.5 s is never shown.
 *  - `navigator.onLine` events only TRIGGER a probe (E15: on Windows the flag is unreliable).
 *  - Probe: anonymous, `cache: 'no-store'`, 5 s timeout; online means 200 with JSON `ok === true`
 *    (a captive portal's HTML 200 counts as unreachable). A refusal from the server itself (its own
 *    JSON error) proves it is there.
 *  - Schedule while offline and visible: 2, 4, 8, 16, 32, then every 60 s, +-20 % jitter; paused while
 *    hidden. An immediate probe (at most one per 2 s; it resets the schedule) runs on `online`,
 *    `offline`, `visibilitychange` to visible, `focus`, `pageshow`, the platform's `notifyResume()`,
 *    a write while offline and "Try now".
 *  - SYNCING shows "Uploading..." for at least 1 s once the connection returns with changes waiting;
 *    then "All changes are saved on the server" for 2.5 s (`showDrained`).
 * The monitor mirrors its state into the status store (./status.ts) for the UI.
 */
import { isApiClientError, isConnectionError, request } from '@/api/client';
import { getConnectionState, notifyReconnected, reportConnectionLost, subscribeConnection } from '@/api/connection';
import { onResume } from './seams';
import { patchSyncStatus, type ConnectionPhase } from './status';

export const OFFLINE_SHOW_MS = 1500;
export const SYNCING_MIN_MS = 1000;
export const DRAINED_SHOW_MS = 2500;
export const PROBE_TIMEOUT_MS = 5000;
export const PROBE_SCHEDULE_S: readonly number[] = [2, 4, 8, 16, 32];
export const PROBE_STEADY_S = 60;
export const PROBE_JITTER = 0.2;
export const IMMEDIATE_PROBE_GAP_MS = 2000;

/**
 * The default probe: `GET /api/health`. True only when the diary server itself answered: a 200 with
 * JSON `ok === true`, or a refusal carrying the server's own JSON error (it proves the server is
 * there). A captive portal's HTML 200 (JSON.parse fails), or any status without the server's JSON body
 * (an HTML 511 / 403 of a portal or proxy), counts as unreachable - and the connection store, which
 * the client already told "reached", is told the opposite.
 */
export async function probeHealth(): Promise<boolean> {
  try {
    const body = await request<{ ok?: boolean } | undefined>('/api/health', { anonymous: true, timeoutMs: PROBE_TIMEOUT_MS, cache: 'no-store' });
    if (body && typeof body === 'object' && body.ok === true) return true;
    // A 200 that is not the server's JSON (a captive portal page): the client believed it reached the server.
    reportConnectionLost();
    return false;
  } catch (e) {
    if (isApiClientError(e) && e.fromServer && !isConnectionError(e)) return true;
    // A lost connection reported itself already; anything else did not come from the diary server.
    if (!isConnectionError(e)) reportConnectionLost();
    return false;
  }
}

export interface ConnectivityOptions {
  probe?: () => Promise<boolean>;
  now?: () => number;
  random?: () => number;
  /** True while the page is visible (the schedule pauses while hidden). */
  visible?: () => boolean;
  /**
   * Called whenever the server is known to be reachable again or still: after every successful probe
   * (focus, visibility, resume, the schedule) and when an ordinary request noticed the reconnect (the
   * replayer kicks: section 4.5 "probe success; resume or visibility").
   */
  onReconnected?: () => void;
  /** How many operations wait (decides ONLINE vs SYNCING after a reconnect). */
  pendingCount?: () => number;
}

type Timer = ReturnType<typeof setTimeout>;

export class ConnectivityMonitor {
  private phase: ConnectionPhase = 'online';
  private showOffline = false;
  private failingSince: number | null = null;
  private showTimer: Timer | null = null;
  private probeTimer: Timer | null = null;
  private drainedTimer: Timer | null = null;
  private syncingSince: number | null = null;
  private scheduleIndex = 0;
  private lastProbeAt = Number.NEGATIVE_INFINITY;
  private probing: Promise<boolean> | null = null;
  private reaching = false;
  private started = false;
  private readonly cleanups: (() => void)[] = [];
  private readonly listeners = new Set<() => void>();

  private readonly probe: () => Promise<boolean>;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly visible: () => boolean;
  private readonly onReconnected: () => void;
  private readonly pendingCount: () => number;

  constructor(opts: ConnectivityOptions = {}) {
    this.probe = opts.probe ?? probeHealth;
    this.now = opts.now ?? (() => Date.now());
    this.random = opts.random ?? Math.random;
    this.visible = opts.visible ?? (() => (typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'));
    this.onReconnected = opts.onReconnected ?? (() => {});
    this.pendingCount = opts.pendingCount ?? (() => 0);
  }

  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  get state(): ConnectionPhase {
    return this.phase;
  }

  /** True while the data layer must serve reads from the cache (from the first failure on). */
  get dataOffline(): boolean {
    return this.phase === 'suspect' || this.phase === 'offline';
  }

  /** True once the UI should show the offline bar (section 4.2 "1.5 s"). */
  get offlineShown(): boolean {
    return this.showOffline;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  start(): void {
    if (this.started) return;
    this.started = true;
    let wasOffline = getConnectionState().offline;
    this.cleanups.push(
      subscribeConnection(() => {
        const offline = getConnectionState().offline;
        if (offline === wasOffline) return;
        wasOffline = offline;
        // The probe's own request flips the store too (a portal's HTML 200 first says "reached"): while
        // a probe is in flight its answer decides, not the flips it causes.
        if (this.probing) return;
        if (offline) this.noteFailure();
        else this.serverReached();
      }),
    );
    if (wasOffline) this.noteFailure();
    if (typeof window !== 'undefined') {
      const probeOn = (event: string, target: Window | Document = window, filter: () => boolean = () => true) => {
        const handler = () => {
          if (filter()) void this.probeNow(event);
        };
        target.addEventListener(event, handler);
        this.cleanups.push(() => target.removeEventListener(event, handler));
      };
      probeOn('online');
      probeOn('offline');
      probeOn('focus');
      probeOn('pageshow');
      if (typeof document !== 'undefined') probeOn('visibilitychange', document, () => this.visible());
    }
    this.cleanups.push(onResume(() => void this.probeNow('resume')));
  }

  stop(): void {
    this.started = false;
    for (const c of this.cleanups.splice(0)) c();
    this.clearTimer('show');
    this.clearTimer('probe');
    this.clearTimer('drained');
    this.phase = 'online';
    this.showOffline = false;
    this.failingSince = null;
    this.syncingSince = null;
    this.publish();
  }

  // -------------------------------------------------------------------------
  // Signals
  // -------------------------------------------------------------------------

  /** A request could not reach the server (the connection store flipped, or a caller says so). */
  noteFailure(): void {
    if (this.phase === 'offline') return;
    if (this.phase === 'suspect') return;
    this.failingSince = this.now();
    this.syncingSince = null;
    this.clearTimer('drained');
    this.setPhase('suspect');
    this.clearTimer('show');
    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      if (this.phase === 'suspect') this.goOffline();
    }, OFFLINE_SHOW_MS);
  }

  /** The server answered (any request, or the probe). */
  noteSuccess(): void {
    const wasDown = this.dataOffline;
    this.clearTimer('show');
    this.clearTimer('probe');
    this.failingSince = null;
    this.scheduleIndex = 0;
    this.showOffline = false;
    if (wasDown && this.pendingCount() > 0) {
      this.syncingSince = this.now();
      this.setPhase('syncing');
    } else if (this.phase !== 'syncing') {
      this.setPhase('online');
    } else {
      this.publish();
    }
    patchSyncStatus({ nextProbeAt: null });
  }

  /** The replayer: the outbox drained ("All changes are saved on the server" after at least 1 s of SYNCING). */
  drained(): void {
    if (this.phase !== 'syncing') return;
    const shownFor = this.now() - (this.syncingSince ?? this.now());
    const finish = () => {
      if (this.phase !== 'syncing') return;
      this.syncingSince = null;
      this.setPhase('online');
      patchSyncStatus({ showDrained: true, lastDrainedAt: this.now() });
      this.clearTimer('drained');
      this.drainedTimer = setTimeout(() => {
        this.drainedTimer = null;
        patchSyncStatus({ showDrained: false });
      }, DRAINED_SHOW_MS);
    };
    if (shownFor >= SYNCING_MIN_MS) finish();
    else {
      this.clearTimer('drained');
      this.drainedTimer = setTimeout(finish, SYNCING_MIN_MS - shownFor);
    }
  }

  /** The replayer stopped with operations left (a chain waits, the session is locked...): no "uploading" any more. */
  uploadPaused(): void {
    if (this.phase !== 'syncing') return;
    this.syncingSince = null;
    this.setPhase('online');
  }

  /**
   * An immediate probe (at most one every 2 s; the schedule resets). Resolves with the probe's answer,
   * or with the current reachability when throttled.
   */
  async probeNow(_reason = 'manual', force = false): Promise<boolean> {
    if (this.probing) {
      // A probe is in flight (maybe issued while the server was still down): a forced probe waits for it and asks again.
      const inFlight = await this.probing;
      if (!force) return inFlight;
    }
    if (!force && this.now() - this.lastProbeAt < IMMEDIATE_PROBE_GAP_MS) return !this.dataOffline;
    this.scheduleIndex = 0;
    this.clearTimer('probe');
    return this.runProbe();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * The server answered - the probe, or an ordinary request the connection store reported. A
   * reconnect re-runs what gave up (`notifyReconnected`: the AuthProvider's session check of a cache
   * session); either way the replayer is kicked, so "Uploading..." never waits for a probe that may
   * not come (a reconnect noticed by a request clears the probe schedule).
   */
  private serverReached(): void {
    // `notifyReconnected` emits to the store this monitor listens to: that echo is not a second reconnect.
    if (this.reaching) return;
    this.reaching = true;
    try {
      const wasDown = this.dataOffline;
      this.noteSuccess();
      if (wasDown) notifyReconnected();
      this.onReconnected();
    } finally {
      this.reaching = false;
    }
  }

  private goOffline(): void {
    this.setPhase('offline');
    this.showOffline = true;
    this.publish();
    this.scheduleProbe();
  }

  private async runProbe(): Promise<boolean> {
    this.lastProbeAt = this.now();
    // `probing` is set BEFORE the probe runs: whatever its request reports to the connection store,
    // even synchronously, happens while a probe is known to be in flight.
    let settle!: (ok: boolean) => void;
    this.probing = new Promise<boolean>((resolve) => (settle = resolve));
    let ok = false;
    try {
      ok = await this.probe();
    } catch {
      ok = false;
    } finally {
      this.probing = null;
      settle(ok);
    }
    if (!this.started && this.phase === 'online' && !this.failingSince) return ok;
    if (ok) {
      this.serverReached();
    } else {
      if (this.phase === 'online' || this.phase === 'syncing') this.noteFailure();
      // A failed probe shows the bar at once (section 4.2) and keeps the schedule going.
      if (this.phase === 'suspect') {
        this.clearTimer('show');
        this.goOffline();
      } else if (this.phase === 'offline') {
        this.scheduleProbe();
      }
    }
    return ok;
  }

  private scheduleProbe(): void {
    this.clearTimer('probe');
    if (this.phase !== 'offline' || !this.started) return;
    if (!this.visible()) {
      patchSyncStatus({ nextProbeAt: null });
      return;
    }
    const baseS = this.scheduleIndex < PROBE_SCHEDULE_S.length ? PROBE_SCHEDULE_S[this.scheduleIndex] : PROBE_STEADY_S;
    this.scheduleIndex++;
    const jitter = 1 + (this.random() * 2 - 1) * PROBE_JITTER;
    const delay = Math.round(baseS * 1000 * jitter);
    patchSyncStatus({ nextProbeAt: this.now() + delay });
    this.probeTimer = setTimeout(() => {
      this.probeTimer = null;
      void this.runProbe();
    }, delay);
  }

  private setPhase(phase: ConnectionPhase): void {
    this.phase = phase;
    if (phase !== 'offline') this.showOffline = false;
    this.publish();
  }

  private publish(): void {
    patchSyncStatus({ phase: this.phase, showOffline: this.showOffline });
    for (const l of [...this.listeners]) l();
  }

  private clearTimer(which: 'show' | 'probe' | 'drained'): void {
    const key = `${which}Timer` as const;
    const t = this[key];
    if (t) clearTimeout(t);
    this[key] = null;
  }
}
