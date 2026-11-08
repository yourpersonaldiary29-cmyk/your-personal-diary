/**
 * The connection to the diary server, for the UI (docs/android-tasks/HOSTED-IMPL.md item 8: "a clear
 * 'no connection to the server' screen with retry").
 *
 * State lives in the external store src/api/connection.ts (the api client writes it on every request);
 * this module adds the two things that need requests:
 *  - the PROBE: `GET /api/server/info` once at start (ConnectionProvider) - it tells whether the server
 *    is the hosted Your Personal Diary server (`mode: 'hosted'`), whether it offers the tour
 *    (`guestTour`) and its public address, and it is the first request of a run, so an unreachable
 *    server shows the connection screen before anything else is tried;
 *  - RETRY (`retryConnection`): the probe again; when it reaches the server, `notifyReconnected()`
 *    re-runs what gave up meanwhile (the AuthProvider's session check). The browser's `online` event
 *    retries by itself.
 *
 * What the UI shows (`useConnectionDisplay`):
 *  - the full-page NoConnectionPage while the server has not answered yet in this run (nothing else
 *    would work: start-up, the session check), and
 *  - the ConnectionBanner over the running app once it had worked (a request failed later) - the
 *    user's screen and typed text stay; later the automatic offline mode (WP-H10) replaces the banner.
 *
 * `useServerInfo()` / `useHostedServer()` are read by the Settings page (hide what a hosted server does
 * not offer, show its address) and by the tour button of the Android app (hidden there when a hosted
 * server says `guestTour: false`; the Windows app and the web UI never offer the tour).
 * Without the provider (page tests) the hooks read the store as it is: no info, online.
 */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { ServerInfo } from '@shared/types';
import {
  apiBaseKind,
  getConnectionState,
  isConnectionError,
  isServerMode,
  notifyReconnected,
  server as serverApi,
  setConnectionUiActive,
  setRetrying,
  setServerInfo,
  subscribeConnection,
  type ConnectionState,
} from '@/api';
import { defaultServerHost } from '@/config/server-default';
import { offline as offlineEngine } from '@/offline';
import { useAuth } from './AuthContext';

/** Asks the server to describe itself; resolves true when it answered (any answer), false when it cannot be reached. */
export async function probeServer(): Promise<boolean> {
  try {
    const info = await serverApi.info();
    setServerInfo(info && typeof info === 'object' ? info : null);
    return true;
  } catch (e) {
    // The client reported a lost connection already; any other failure means the server is there.
    return !isConnectionError(e);
  }
}

let retryInFlight: Promise<boolean> | null = null;

/**
 * The Retry action: probes the server once (concurrent calls share one probe) and, when it answers,
 * tells the effects that gave up to run again. Resolves true when the server was reached.
 */
export function retryConnection(): Promise<boolean> {
  if (!retryInFlight) {
    setRetrying(true);
    retryInFlight = probeServer()
      .then((ok) => {
        if (ok) notifyReconnected();
        return ok;
      })
      .finally(() => {
        retryInFlight = null;
        setRetrying(false);
      });
  }
  return retryInFlight;
}

/** The connection store as a React subscription. */
export function useConnection(): ConnectionState {
  return useSyncExternalStore(subscribeConnection, getConnectionState, getConnectionState);
}

/** The server's self-description (GET /api/server/info), or null while unknown. */
export function useServerInfo(): ServerInfo | null {
  return useConnection().info;
}

/**
 * True when this UI talks to the Your Personal Diary server - in the apps always (the fixed address),
 * on the web once the server said `mode: 'hosted'`. Settings then hides the cards of a local server
 * (diagnostics, phone access on the home network) and shows the server's address read-only.
 */
export function useHostedServer(): boolean {
  const info = useServerInfo();
  return info?.mode === 'hosted' || isServerMode();
}

/**
 * The host of the diary server for read-only display (the Privacy card): what the hosted server reports
 * as its public address, else the apps' fixed address; null for a local server / the plain web UI.
 */
export function useServerHost(): string | null {
  const info = useServerInfo();
  if (info?.mode === 'hosted' && info.publicUrl) {
    try {
      return new URL(info.publicUrl).host;
    } catch {
      /* an unexpected value: fall through */
    }
  }
  return apiBaseKind() === 'server' ? defaultServerHost() : null;
}

/** What to show for a lost connection: the full page, the banner, or nothing. */
export type ConnectionDisplay = 'page' | 'banner' | null;

export function useConnectionDisplay(): ConnectionDisplay {
  const { offline, reached, active } = useConnection();
  const { status, source, cacheStartPending } = useAuth();
  // Without the provider (a tree that renders pages alone) a failed request is the page's own business.
  if (!active || !offline) return null;
  // A session the apps started from the encrypted cache (OFFLINE-DESIGN.md section 4.7): the diary is on
  // screen, so the bar (the offline-mode status bar takes the banner's slot), never the full page.
  if (status === 'authenticated' && source === 'cache') return 'banner';
  // The apps' offline start may still bring that diary (the key unwraps, the snapshot decrypts - a DPAPI
  // or Keystore round trip on a real device): until it has resolved, nothing - the routes keep the
  // session spinner. The page would only flash, and move the focus to its heading, before the diary.
  if (status === 'loading' && cacheStartPending) return null;
  // Nothing of the user's is on screen yet (start-up, the session check): the page. Later: the banner.
  return status === 'loading' || !reached ? 'page' : 'banner';
}

/**
 * Turns the connection UI on (`active`), probes the server once at start and retries when the browser
 * reports the network is back. Keeps no React state of its own - everything is in the store, so it can
 * sit anywhere above the app.
 */
export function ConnectionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    setConnectionUiActive(true);
    void probeServer();
    const onOnline = () => {
      // While offline mode runs, its connectivity monitor probes on `online` itself (and on much more,
      // OFFLINE-DESIGN.md section 4.2): this retry would only duplicate it.
      if (offlineEngine.isActive()) return;
      if (getConnectionState().offline) void retryConnection();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      setConnectionUiActive(false);
    };
  }, []);
  return <>{children}</>;
}

/** Tests only: forgets a retry in flight. */
export function __resetConnectionContextForTests(): void {
  retryInFlight = null;
}
