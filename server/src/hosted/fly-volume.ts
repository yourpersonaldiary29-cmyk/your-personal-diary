/**
 * The Fly Machines API client of the disk button (docs/server-tasks/SERVER-CARD-V2.md Part B2) - hosted mode
 * only: hosted/disk.ts uses it and only the hosted composition (hosted.ts) builds that; the desktop sidecar and
 * the Android core never import it.
 *
 * Besides the SMTP client of the Mail card this is the one outbound connection of a hosted server, and it is
 * made only while the owner set up the disk button (the secret DIARY_FLY_API_TOKEN). scripts/check-no-network.mjs
 * lets exactly this file import node:https and name exactly https://api.machines.dev; no other file may name
 * that host.
 *
 * Endpoint: the public https://api.machines.dev/v1, not the private http://_api.internal:4280, because
 *   - it is TLS with certificate validation all the way; the private endpoint is plain HTTP (inside Fly's
 *     WireGuard network, but the token would still travel unencrypted on it);
 *   - it is the endpoint the owner's setup script (scripts/hosted/set-disk-key.ps1) checks from his own PC,
 *     so its checks prove exactly what the server will do;
 *   - it needs no private DNS (_api.internal resolves only through Fly's 6PN resolver).
 *
 * The calls - nothing else exists here, and the transport refuses anything but GET / POST / PUT under
 * https://api.machines.dev/v1/apps/ (never a DELETE):
 *   read     GET  /apps/{app}/volumes                  the app's volumes: the one attached to this machine
 *            GET  /apps/{app}/volumes/{id}             the volume (when DIARY_FLY_VOLUME_ID names it)
 *            GET  /apps/{app}/volumes/{id}/snapshots   its snapshots
 *   change   POST /apps/{app}/volumes/{id}/snapshots   create a snapshot
 *            PUT  /apps/{app}/volumes/{id}/extend      { "size_gb": n } -> { "needs_restart": bool, "volume": {...} }
 *            POST /apps/{app}/machines/{this machine}/restart
 * Every call has a timeout of its own (FLY_TIMEOUTS), enforced here whatever the transport does. A call that
 * changes something is never repeated: when its answer is lost, the caller learns "timeout" / "network" and
 * decides - nothing is sent again.
 *
 * Authorization: a token that starts with "FlyV1 " (a macaroon, as `fly tokens create deploy` and
 * `fly tokens attenuate` print it) is sent as it is; any other token gets "Bearer ". The token is never logged
 * and never part of an error: errors carry the call's name, a kind and the HTTP status only.
 */
import https from 'node:https';

/** The one endpoint (see the file comment). */
export const FLY_API_BASE = 'https://api.machines.dev/v1';
export const FLY_API_HOST = new URL(FLY_API_BASE).host;

export type FlyMethod = 'GET' | 'POST' | 'PUT';
const METHODS: ReadonlySet<string> = new Set<FlyMethod>(['GET', 'POST', 'PUT']);

/** One request as the transport gets it: the full URL, the headers (Authorization included), a JSON body. */
export interface FlyHttpRequest {
  method: FlyMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

/** Any HTTP answer: the status and the body as text. A transport rejects only when no answer came. */
export interface FlyHttpResponse {
  status: number;
  body: string;
}

/** Carries one request to the Fly Machines API. The server's is `nodeFlyHttp`; tests inject a fake. */
export type FlyHttp = (req: FlyHttpRequest) => Promise<FlyHttpResponse>;

/** Milliseconds each kind of call may take. */
export interface FlyTimeouts {
  read: number;
  snapshot: number;
  extend: number;
  restart: number;
}

export const FLY_TIMEOUTS: Readonly<FlyTimeouts> = Object.freeze({ read: 15_000, snapshot: 30_000, extend: 60_000, restart: 60_000 });

/** Largest answer read (a list of volumes or snapshots is a few KB). */
const MAX_ANSWER_BYTES = 1024 * 1024;

/**
 * What went wrong with a call: Fly refused the key ('unauthorized': 401 / 403, or an answer that says so),
 * the volume or machine is unknown ('not-found'), Fly refused the request itself ('refused': another 4xx),
 * Fly failed ('unavailable': 5xx), no answer in time ('timeout'), no connection ('network'), or an answer
 * that could not be read ('bad-answer').
 */
export type FlyErrorKind = 'unauthorized' | 'not-found' | 'refused' | 'unavailable' | 'timeout' | 'network' | 'bad-answer';

export class FlyApiError extends Error {
  constructor(
    readonly kind: FlyErrorKind,
    /** The HTTP status; 0 when no answer came. */
    readonly status: number,
    /** Which call ('read volume', 'extend', ...). */
    readonly call: string,
  ) {
    super(`Fly API ${call}: ${kind}${status ? ` (HTTP ${status})` : ''}`);
    this.name = 'FlyApiError';
  }
}

export function isFlyApiError(e: unknown): e is FlyApiError {
  return e instanceof FlyApiError;
}

/** The Authorization header value: a "FlyV1 " macaroon as it is, any other token as "Bearer <token>". */
export function flyAuthorization(token: string): string {
  const t = token.trim();
  return t.startsWith('FlyV1 ') ? t : `Bearer ${t}`;
}

/** The transport's own "no answer in time" (mapped to the kind 'timeout'). */
class FlyTimeout extends Error {
  constructor() {
    super('no answer in time');
    this.name = 'FlyTimeout';
  }
}

/** True when `url` is a Machines API URL this module may call. */
function isFlyApiUrl(url: string): boolean {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  return target.protocol === 'https:' && target.host === FLY_API_HOST && target.pathname.startsWith('/v1/apps/') && !target.username && !target.password;
}

/**
 * The transport of a running server: node:https to api.machines.dev - one connection per request, the
 * certificate checked, at most 1 MiB read. It refuses every other host, scheme, path and method before
 * anything leaves the machine.
 */
export const nodeFlyHttp: FlyHttp = (req) => {
  if (!METHODS.has(req.method) || !isFlyApiUrl(req.url)) {
    return Promise.reject(new Error('refused: only GET, POST and PUT to the Fly Machines API'));
  }
  return new Promise<FlyHttpResponse>((resolve, reject) => {
    let settled = false;
    const done = (err: Error | null, value?: FlyHttpResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value as FlyHttpResponse);
    };
    const headers: Record<string, string> = { 'User-Agent': 'YourPersonalDiary', Accept: 'application/json', ...req.headers };
    if (req.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(req.body));
    }
    const request = https.request(new URL(req.url), { method: req.method, headers, agent: false }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_ANSWER_BYTES) {
          request.destroy();
          done(new Error('answer too large'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => done(null, { status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', (e) => done(e));
    });
    const timer = setTimeout(() => {
      request.destroy();
      done(new FlyTimeout());
    }, req.timeoutMs);
    request.on('error', (e) => done(e));
    if (req.body !== undefined) request.write(req.body);
    request.end();
  });
};

/** A volume as this module reports it. */
export interface FlyVolume {
  id: string;
  /** `size_gb`; null when the answer had no whole number there. */
  sizeGb: number | null;
  state: string;
  /** The machine it is attached to; null when none. */
  attachedMachineId: string | null;
}

export interface FlySnapshot {
  id: string;
  /** Fly's word for it ('created' once it is complete). */
  status: string;
  createdAt: string | null;
}

export interface FlyExtendAnswer {
  /** Fly says the machine must restart before the file system shows the new size. */
  needsRestart: boolean;
  /** The size Fly reports after the change; null when its answer did not say. */
  sizeGb: number | null;
}

/** Everything the disk button may ask of Fly - and nothing more. */
export interface FlyVolumeApi {
  listVolumes(): Promise<FlyVolume[]>;
  getVolume(volumeId: string): Promise<FlyVolume>;
  listSnapshots(volumeId: string): Promise<FlySnapshot[]>;
  createSnapshot(volumeId: string): Promise<void>;
  extendVolume(volumeId: string, sizeGb: number): Promise<FlyExtendAnswer>;
  /** Restarts THIS machine (`machineId` of the options) - no other. */
  restartMachine(): Promise<void>;
}

export interface FlyVolumeApiOptions {
  /** DIARY_FLY_API_TOKEN (secret). */
  token: string;
  /** FLY_APP_NAME. */
  app: string;
  /** FLY_MACHINE_ID: the machine this server runs on. */
  machineId: string;
  /** Default: `nodeFlyHttp`. */
  http?: FlyHttp;
  timeouts?: Partial<FlyTimeouts>;
}

/** Fly app names: lower-case letters, digits and hyphens. */
export const FLY_APP_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** Machine and volume ids: letters, digits and underscores (`1781973f2f5e89`, `vol_x2m8y9q3`). */
export const FLY_ID_RE = /^[A-Za-z0-9_]{1,64}$/;

/** `size_gb` when it is a whole number above 0. */
function sizeOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function toVolume(raw: unknown): FlyVolume | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !FLY_ID_RE.test(o.id)) return null;
  return {
    id: o.id,
    sizeGb: sizeOf(o.size_gb),
    state: typeof o.state === 'string' ? o.state : '',
    attachedMachineId: typeof o.attached_machine_id === 'string' && o.attached_machine_id ? o.attached_machine_id : null,
  };
}

function toSnapshot(raw: unknown): FlySnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) return null;
  return { id: o.id, status: typeof o.status === 'string' ? o.status.toLowerCase() : '', createdAt: typeof o.created_at === 'string' ? o.created_at : null };
}

/** An answer whose text says the key may not do this (macaroon errors read "unauthorized for ..."). */
const SAYS_UNAUTHORIZED = /\bunauthori[sz]ed\b|\bnot authori[sz]ed\b|\bpermission denied\b/i;

export function createFlyVolumeApi(opts: FlyVolumeApiOptions): FlyVolumeApi {
  if (!FLY_APP_RE.test(opts.app)) throw new Error('the Fly app name is not valid');
  if (!FLY_ID_RE.test(opts.machineId)) throw new Error('the Fly machine id is not valid');
  if (!opts.token.trim()) throw new Error('no Fly API token');
  const http = opts.http ?? nodeFlyHttp;
  const timeouts: FlyTimeouts = { ...FLY_TIMEOUTS, ...opts.timeouts };
  const authorization = flyAuthorization(opts.token);
  const app = encodeURIComponent(opts.app);
  const machine = encodeURIComponent(opts.machineId);
  const volumePath = (volumeId: string): string => {
    if (!FLY_ID_RE.test(volumeId)) throw new FlyApiError('not-found', 0, 'volume id');
    return `/apps/${app}/volumes/${encodeURIComponent(volumeId)}`;
  };

  /**
   * One call: the request, its own timeout, the status mapped to an error kind. The answer: its JSON
   * ('json': an answer that is not JSON is a 'bad-answer'), its JSON or null ('lenient': a 2xx is the
   * outcome, its body only informs), or nothing ('none').
   */
  async function call(name: string, method: FlyMethod, path: string, timeoutMs: number, body?: unknown, answer: 'json' | 'lenient' | 'none' = 'json'): Promise<unknown> {
    const req: FlyHttpRequest = {
      method,
      url: `${FLY_API_BASE}${path}`,
      headers: { Authorization: authorization },
      timeoutMs,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
    let timer: NodeJS.Timeout | undefined;
    let res: FlyHttpResponse;
    try {
      res = await Promise.race([
        http(req),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new FlyTimeout()), timeoutMs);
        }),
      ]);
    } catch (e) {
      throw new FlyApiError(e instanceof FlyTimeout ? 'timeout' : 'network', 0, name);
    } finally {
      clearTimeout(timer);
    }
    const status = res.status;
    const text = typeof res.body === 'string' ? res.body : '';
    if (status === 401 || status === 403) throw new FlyApiError('unauthorized', status, name);
    if (status === 404) throw new FlyApiError('not-found', status, name);
    if (status >= 500) throw new FlyApiError('unavailable', status, name);
    if (status < 200 || status >= 300) throw new FlyApiError(SAYS_UNAUTHORIZED.test(text) ? 'unauthorized' : 'refused', status, name);
    if (answer === 'none') return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      if (answer === 'lenient') return null;
      throw new FlyApiError('bad-answer', status, name);
    }
  }

  return {
    async listVolumes() {
      const raw = await call('list volumes', 'GET', `/apps/${app}/volumes`, timeouts.read);
      if (!Array.isArray(raw)) throw new FlyApiError('bad-answer', 200, 'list volumes');
      return raw.map(toVolume).filter((v): v is FlyVolume => v !== null);
    },
    async getVolume(volumeId) {
      const volume = toVolume(await call('read volume', 'GET', volumePath(volumeId), timeouts.read));
      if (!volume || volume.sizeGb === null) throw new FlyApiError('bad-answer', 200, 'read volume');
      return volume;
    },
    async listSnapshots(volumeId) {
      const raw = await call('list snapshots', 'GET', `${volumePath(volumeId)}/snapshots`, timeouts.read);
      if (!Array.isArray(raw)) throw new FlyApiError('bad-answer', 200, 'list snapshots');
      return raw.map(toSnapshot).filter((s): s is FlySnapshot => s !== null);
    },
    async createSnapshot(volumeId) {
      await call('create snapshot', 'POST', `${volumePath(volumeId)}/snapshots`, timeouts.snapshot, undefined, 'none');
    },
    async extendVolume(volumeId, sizeGb) {
      if (sizeOf(sizeGb) === null) throw new FlyApiError('refused', 0, 'extend');
      // The change is done once Fly said 2xx; its answer only says whether a restart is needed.
      const raw = await call('extend', 'PUT', `${volumePath(volumeId)}/extend`, timeouts.extend, { size_gb: sizeGb }, 'lenient');
      const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      return { needsRestart: o.needs_restart === true, sizeGb: toVolume(o.volume)?.sizeGb ?? null };
    },
    async restartMachine() {
      await call('restart', 'POST', `/apps/${app}/machines/${machine}/restart`, timeouts.restart, undefined, 'none');
    },
  };
}
