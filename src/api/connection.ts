/**
 * Connection state of the diary server - one small external store shared by the api client (which
 * writes it), the auth context (which re-runs its session check on a reconnect) and the UI (the
 * "No connection to the diary server" screen and banner, src/context/ConnectionContext.tsx).
 *
 *  - `offline`: the last request could not reach the server (status 0 - a network error -, or a
 *    502 / 503 / 504 that did not come from the diary server itself but from the platform's proxy in
 *    front of it: `isConnectionError` in src/api/client.ts). Any answer from the server clears it.
 *  - `reached`: the server answered at least once in this run. Before that the UI shows the full
 *    connection screen (nothing else would work); afterwards a banner over the running app.
 *  - `info`: the server's self-description (GET /api/server/info), loaded once at start by the
 *    ConnectionProvider and again on every successful reconnect; it tells the UI whether the server is
 *    the hosted Your Personal Diary server (`mode: 'hosted'`), whether it offers the tour
 *    (`guestTour`) and its public address.
 *  - `attempt`: bumped by every SUCCESSFUL reconnect (`notifyReconnected`): effects that gave up while
 *    the server was unreachable - the initial session check of the AuthProvider - depend on it and run
 *    again.
 *  - `retrying`: a reconnect is in flight (the Retry button shows its spinner everywhere).
 *
 * The store is plain data: no request is made here (src/context/ConnectionContext.tsx probes).
 * Later packages (automatic offline mode, WP-H10) build on the same signals.
 */
import type { ServerInfo } from '@shared/types';

export interface ConnectionState {
  /** True while the diary server cannot be reached (see the module comment). */
  offline: boolean;
  /** True once the server has answered any request in this run of the app. */
  reached: boolean;
  /** What GET /api/server/info answered, or null before it did (or when it never did). */
  info: ServerInfo | null;
  /** Counts the successful reconnects of this run (effects that gave up re-run on it). */
  attempt: number;
  /** True while a reconnect (Retry) is in flight. */
  retrying: boolean;
  /**
   * True while the connection UI is mounted (the ConnectionProvider of the app): only then is a lost
   * connection SHOWN (page / banner) and only then may the session check wait for its Retry instead of
   * giving up. In a tree without the provider (page tests) a failed request stays what it was: an error
   * the page handles itself.
   */
  active: boolean;
}

const INITIAL: ConnectionState = { offline: false, reached: false, info: null, attempt: 0, retrying: false, active: false };

let state: ConnectionState = INITIAL;
const listeners = new Set<() => void>();

function emit(next: Partial<ConnectionState>): void {
  const merged: ConnectionState = { ...state, ...next };
  if (
    merged.offline === state.offline &&
    merged.reached === state.reached &&
    merged.info === state.info &&
    merged.attempt === state.attempt &&
    merged.retrying === state.retrying &&
    merged.active === state.active
  ) {
    return;
  }
  state = merged;
  for (const listener of [...listeners]) listener();
}

/** The current snapshot (stable object identity until something changes - fit for useSyncExternalStore). */
export function getConnectionState(): ConnectionState {
  return state;
}

/** Subscribes to changes; returns the unsubscribe function. */
export function subscribeConnection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The api client: a request failed to reach the server. */
export function reportConnectionLost(): void {
  emit({ offline: true });
}

/** The api client: the server answered (any status counts, a refusal proves the server is there). */
export function reportServerReached(): void {
  emit({ offline: false, reached: true });
}

/** Remembers what GET /api/server/info answered (null forgets it). */
export function setServerInfo(info: ServerInfo | null): void {
  emit({ info });
}

/** The server's self-description, or null while unknown. */
export function getServerInfo(): ServerInfo | null {
  return state.info;
}

/** The number of successful reconnects so far (see `notifyReconnected`). */
export function getConnectionAttempt(): number {
  return state.attempt;
}

/** A reconnect reached the server: effects that gave up while it was unreachable run again. */
export function notifyReconnected(): void {
  emit({ attempt: state.attempt + 1, offline: false, reached: true });
}

/** Marks a reconnect as in flight / finished (the Retry buttons show the spinner). */
export function setRetrying(retrying: boolean): void {
  emit({ retrying });
}

/** The ConnectionProvider: the connection UI is mounted (true) / gone (false). */
export function setConnectionUiActive(active: boolean): void {
  emit({ active });
}

/** True while the connection UI (page / banner with Retry) is mounted - see `ConnectionState.active`. */
export function isConnectionUiActive(): boolean {
  return state.active;
}

/** Tests only: back to the state of a fresh start. */
export function __resetConnectionForTests(): void {
  emit(INITIAL);
}
