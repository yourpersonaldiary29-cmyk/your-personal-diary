/**
 * Errors and small async helpers of the remote-access module.
 *
 * A `RemoteError` carries a catalogue key ('server.remote.*') and flat parameters: the manager
 * copies them into the status step, and the UI renders them in its own language.
 */
export type RemoteParams = Record<string, string | number>;

export class RemoteError extends Error {
  readonly key: string;
  readonly params: RemoteParams;
  constructor(key: string, params: RemoteParams = {}, detail?: string) {
    super(detail ? `${key}: ${detail}` : key);
    this.name = 'RemoteError';
    this.key = key;
    this.params = params;
  }
}

/** Thrown when a run was superseded (settings changed, remote access turned off, server stopping). */
export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

export function isCancelled(e: unknown): boolean {
  return e instanceof CancelledError || (e instanceof Error && e.name === 'AbortError');
}

/** Resolves after `ms`, or rejects with CancelledError as soon as `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new CancelledError());
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new CancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CancelledError();
}

/** `text` with every occurrence of each secret replaced by '***'. */
export function redact(text: string, secrets: string[] = []): string {
  let s = text;
  for (const secret of secrets) if (secret) s = s.split(secret).join('***');
  return s;
}

/**
 * An error whose text the app writes itself (a timeout, an unreadable answer): it carries a
 * catalogue key ('server.remote.detail.*') and parameters, so the UI shows it in its own language
 * inside the step message (`errorDetail`) instead of English text in a translated sentence.
 */
export interface KeyedDetail {
  detailKey: string;
  detailParams: RemoteParams;
}

export function isKeyedDetail(e: unknown): e is KeyedDetail {
  return !!e && typeof e === 'object' && typeof (e as KeyedDetail).detailKey === 'string' && !!(e as KeyedDetail).detailParams;
}

/**
 * The {detail} parameter (plus its own parameters) of a step / check message for `e`: the
 * catalogue key of a keyed error - the UI translates it - or the error's own short text (a
 * third-party or operating-system message, e.g. ECONNREFUSED or the ACME server's problem text).
 */
export function errorDetail(e: unknown, secrets: string[] = []): RemoteParams {
  if (isKeyedDetail(e)) return { ...e.detailParams, detail: e.detailKey };
  return { detail: errorText(e, secrets) };
}

/** Short, single-line text of an unknown error (never contains a secret the caller redacts). */
export function errorText(e: unknown, secrets: string[] = []): string {
  const s = redact(e instanceof Error ? e.message : String(e), secrets).replace(/\s+/g, ' ').trim();
  return s.length > 200 ? `${s.slice(0, 197)}...` : s;
}
