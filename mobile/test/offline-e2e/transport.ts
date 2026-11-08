/**
 * The switchable transport of the offline e2e test (OFFLINE-DESIGN.md section 9 "Clients"): the
 * `ApiTransport` of src/api/client.ts that device A's api client and offline engine use, in four modes:
 *
 *  - `online`        - forwards to the test server;
 *  - `down`          - rejects with `TypeError` at once (no route to the server; nothing is sent);
 *  - `blackhole`     - forwards the request but never settles until the request's signal aborts
 *                      (a dead mobile link: the server may get the request, the answer never comes);
 *  - `drop-response` - forwards the request, waits for the server's answer, then throws `TypeError`
 *                      (the server applied it, the device never heard).
 *
 * One-shot rules (`once`) switch the mode for the next matching request only, optionally changing
 * the default mode right after (`then`): "drop the answer of the first operation, and the network is
 * gone from then on".
 *
 * WebView fidelity: every request carries `Origin: https://localhost` (the Android WebView,
 * capacitor.config.ts androidScheme 'https') and is checked the way the WebView checks a cross-origin
 * call - a preflight for non-simple requests (cached per method and header set), the answer's
 * `Access-Control-Allow-Origin`, and only the CORS-safelisted plus exposed response headers are
 * visible to the page. A server that refused the origin would make the device look offline (E3).
 *
 * Every URL is logged (step 8: every fetched URL is the test server), and every `/api/sync/op` is
 * recorded with its exact body and the server's answer, so the test can check order, outcomes and
 * that a retry is byte-identical.
 */
import type { SyncOp, SyncOpResult } from '@shared/sync';

export type NetMode = 'online' | 'down' | 'blackhole' | 'drop-response';

export interface SentOp {
  /** The body exactly as sent. */
  body: string;
  op: SyncOp;
  token: string | null;
  mode: NetMode;
  /** Set when the server answered (also for drop-response: the server's answer the device never saw). */
  status?: number;
  result?: SyncOpResult;
}

export interface RequestRecord {
  url: string;
  method: string;
  mode: NetMode;
  status?: number;
}

interface OnceRule {
  match: (url: string, method: string) => boolean;
  mode: NetMode;
  then?: NetMode;
}

/** Response headers a page can read cross-origin without `Access-Control-Expose-Headers` (Fetch standard). */
const SAFELISTED_RESPONSE_HEADERS = new Set(['cache-control', 'content-language', 'content-length', 'content-type', 'expires', 'last-modified', 'pragma']);
/** Request headers that never need a preflight (with the values the client sends). */
const SAFELISTED_REQUEST_HEADERS = new Set(['accept', 'accept-language', 'content-language']);

export class SwitchableTransport {
  mode: NetMode = 'online';
  /** Requests started and not settled yet (a switch of the mode affects only the ones that start after it). */
  inFlight = 0;
  readonly requests: RequestRecord[] = [];
  readonly ops: SentOp[] = [];
  /** Preflights that failed (a CORS refusal looks like a lost connection to the page). */
  readonly corsFailures: string[] = [];
  private rules: OnceRule[] = [];
  private readonly preflights = new Map<string, Promise<boolean>>();

  constructor(
    private readonly realFetch: typeof fetch,
    readonly origin = 'https://localhost',
  ) {}

  set(mode: NetMode): void {
    this.mode = mode;
  }

  /** The next request matching `path` (and `method`) goes out in `mode`; afterwards the default becomes `then` (when given). */
  once(path: string, mode: NetMode, opts: { method?: string; then?: NetMode } = {}): void {
    this.rules.push({ match: (url, method) => new URL(url).pathname === path && (!opts.method || opts.method === method), mode, then: opts.then });
  }

  /** The operations sent since `from` (an index into `ops`). */
  opsSince(from: number): SentOp[] {
    return this.ops.slice(from);
  }

  /** The answers the device actually received, in order (online answers of /api/sync/op). */
  outcomesSince(from: number): string[] {
    return this.ops.slice(from).filter((o) => o.mode === 'online' && o.result).map((o) => `${o.op.kind}:${o.result?.outcome}`);
  }

  readonly fetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
    this.inFlight++;
    try {
      return await this.send(url, init);
    } finally {
      this.inFlight--;
    }
  };

  private async send(url: string, init: RequestInit): Promise<Response> {
    const method = (init.method ?? 'GET').toUpperCase();
    let mode = this.mode;
    const ruleIndex = this.rules.findIndex((r) => r.match(url, method));
    if (ruleIndex >= 0) {
      const [rule] = this.rules.splice(ruleIndex, 1);
      mode = rule.mode;
      if (rule.then) this.mode = rule.then;
    }
    const record: RequestRecord = { url, method, mode };
    this.requests.push(record);
    const headers = { ...((init.headers as Record<string, string> | undefined) ?? {}) };
    const sent = new URL(url).pathname === '/api/sync/op' && method === 'POST' ? this.recordOp(init, headers, mode) : null;

    if (mode === 'down') throw new TypeError('fetch failed (the test network is down)');

    // A blackholed request is forwarded in full whatever the device does (it gives up, the server does not know).
    const exchange = this.exchange(url, method, mode === 'blackhole' ? { ...init, signal: undefined } : init, headers);
    if (mode === 'blackhole') {
      // The request may reach the server; the answer never reaches the device.
      exchange.then(
        (r) => {
          record.status = r.status;
          if (sent) void this.noteAnswer(sent, r.clone());
        },
        () => undefined,
      );
      return new Promise<Response>((_resolve, reject) => {
        const signal = init.signal;
        const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
      });
    }
    const res = await exchange;
    record.status = res.status;
    if (sent) await this.noteAnswer(sent, res.clone());
    if (mode === 'drop-response') {
      await res.arrayBuffer().catch(() => undefined);
      throw new TypeError('fetch failed (the test network dropped the answer)');
    }
    return res;
  }

  private recordOp(init: RequestInit, headers: Record<string, string>, mode: NetMode): SentOp | null {
    if (typeof init.body !== 'string') return null;
    const auth = headers.Authorization ?? headers.authorization ?? '';
    const sent: SentOp = { body: init.body, op: JSON.parse(init.body) as SyncOp, token: auth.startsWith('Bearer ') ? auth.slice(7) : null, mode };
    this.ops.push(sent);
    return sent;
  }

  private async noteAnswer(sent: SentOp, res: Response): Promise<void> {
    sent.status = res.status;
    if (res.status !== 200) return;
    try {
      sent.result = (await res.json()) as SyncOpResult;
    } catch {
      /* not JSON */
    }
  }

  /** The request as the WebView makes it: preflight when needed, Origin, the CORS checks, the visible headers. */
  private async exchange(url: string, method: string, init: RequestInit, headers: Record<string, string>): Promise<Response> {
    const unsafe = Object.entries(headers)
      .filter(([name, value]) => {
        const n = name.toLowerCase();
        if (SAFELISTED_REQUEST_HEADERS.has(n)) return false;
        if (n === 'content-type') return !/^(application\/x-www-form-urlencoded|multipart\/form-data|text\/plain)\b/i.test(value);
        return true;
      })
      .map(([name]) => name.toLowerCase())
      .sort();
    const simpleMethod = method === 'GET' || method === 'HEAD' || method === 'POST';
    if (!simpleMethod || unsafe.length) {
      const key = `${new URL(url).origin} ${method} ${unsafe.join(',')}`;
      let ok = this.preflights.get(key);
      if (!ok) {
        ok = this.preflight(url, method, unsafe);
        this.preflights.set(key, ok);
        ok.then((good) => {
          if (!good) this.preflights.delete(key);
        }, () => this.preflights.delete(key));
      }
      if (!(await ok)) {
        this.corsFailures.push(`${method} ${url}`);
        throw new TypeError('fetch failed (CORS preflight refused)');
      }
    }
    const res = await this.realFetch(url, { ...init, headers: { ...headers, Origin: this.origin } });
    if (res.headers.get('access-control-allow-origin') !== this.origin) {
      this.corsFailures.push(`${method} ${url} (answer)`);
      await res.arrayBuffer().catch(() => undefined);
      throw new TypeError('fetch failed (CORS: the answer does not allow this origin)');
    }
    const exposed = new Set((res.headers.get('access-control-expose-headers') ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean));
    const visible = new Headers();
    res.headers.forEach((value, name) => {
      const n = name.toLowerCase();
      if (SAFELISTED_RESPONSE_HEADERS.has(n) || exposed.has(n)) visible.set(name, value);
    });
    const body = res.status === 204 || res.status === 304 ? null : await res.arrayBuffer();
    return new Response(body, { status: res.status, statusText: res.statusText, headers: visible });
  }

  private async preflight(url: string, method: string, unsafeHeaders: string[]): Promise<boolean> {
    let res: Response;
    try {
      res = await this.realFetch(url, {
        method: 'OPTIONS',
        headers: { Origin: this.origin, 'Access-Control-Request-Method': method, ...(unsafeHeaders.length ? { 'Access-Control-Request-Headers': unsafeHeaders.join(',') } : {}) },
      });
    } catch {
      return false;
    }
    await res.arrayBuffer().catch(() => undefined);
    if (res.status >= 300 || res.headers.get('access-control-allow-origin') !== this.origin) return false;
    const methods = (res.headers.get('access-control-allow-methods') ?? '').split(',').map((m) => m.trim().toUpperCase());
    const allowed = new Set((res.headers.get('access-control-allow-headers') ?? '').split(',').map((h) => h.trim().toLowerCase()));
    const simpleMethod = method === 'GET' || method === 'HEAD' || method === 'POST';
    return (simpleMethod || methods.includes(method)) && unsafeHeaders.every((h) => allowed.has(h));
  }
}
