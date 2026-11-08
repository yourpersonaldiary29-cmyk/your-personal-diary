/**
 * Authentication state for the whole UI.
 *
 * - On mount: if a token is stored, `GET /api/auth/me` decides between
 *   `authenticated` and `anonymous`; otherwise `anonymous` immediately.
 * - `login` / `register` store the token (localStorage with "Remember me",
 *   sessionStorage otherwise) and switch to `authenticated`.
 * - `startGuest` (phone app only) starts the tour mode: a temporary guest
 *   account whose token is kept for this app session only (never "Remember
 *   me"); the profile then carries `guest: true` (see `isGuestUser`). The
 *   server gives the guest no name; the profile exposed here shows a localized
 *   "Guest" (mobile.guest.name) as its first name, in the current UI language.
 * - `logout` calls the server, clears the token, navigates to "/" and leaves a
 *   notice ("You have logged out", or "The tour has ended" for the guest) -
 *   unless the caller asks for none (`{ notice: 'none' }`).
 * - `endSession` only forgets the session locally (the server already ended
 *   it: account deleted); the caller announces and navigates.
 * - The api client fires `UNAUTHORIZED_EVENT` on any 401: the provider becomes
 *   `anonymous` and exposes a `notice` that App turns into a toast.
 *
 * Password checks: the api client treats *every* 401 as a lost session, but
 * `verify-password` / `change-password` / `delete-account` answer 401
 * WRONG_PASSWORD for a wrong password. `withPasswordCheck` suppresses the
 * unauthorized event and restores the token in that case.
 *
 * Automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md sections 4.7-4.8; WP-H10c):
 *  - after every successful `me()`, login or registration of an account (not the guest), on a server
 *    that offers offline mode (`ServerInfo.offlineSync`), the offline engine is started
 *    (`offline.start`: key, outbox, replay, warm-up; on an app with "Remember me" also the binding and
 *    the encrypted session snapshot);
 *  - cache start: on the Windows / Android app, the FIRST `me()` that cannot reach the server tries
 *    `offline.startFromCache` (it does not wait for the retries); when the binding, the key and the
 *    snapshot fit, the session is `authenticated` with `source: 'cache'` - locked when the snapshot was
 *    locked or the auto-lock time passed - and `me()` keeps being retried in the background and on every
 *    reconnect; its 200 switches to `source: 'server'`, its 401 ends the session as below. While that
 *    start is still possible or in flight (`cacheStartPending`) the connection display keeps the session
 *    spinner, so the "No connection" page never flashes before the cached diary;
 *  - 401: the engine keeps the outbox and the notes (it drops the cache, the snapshot and the key on its
 *    own); the login page then says how many changes wait ("Sign in again to upload ...") - also when
 *    the very first `me()` of a run answers 401 (the session was revoked while the app was closed): the
 *    account is then read from the binding and its outbox counted without decrypting it;
 *  - sign-out: online, the outbox is uploaded first; with changes left, the user decides first ("Stay
 *    signed in" / "Review" / "Delete them and sign out"); then `offline.wipeAccount` deletes the device's
 *    copy - explicitly here, never inside `clearSignedOutAccountData` (E16). The account deletion wipes
 *    it itself (DeleteAccountSection).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { t, type Locale } from '@shared/i18n';
import type { LoginRequest, RegisterRequest, ServerInfo, UserProfile } from '@shared/types';
import {
  auth as authApi,
  clearToken,
  getConnectionAttempt,
  getServerInfo,
  getToken,
  hasRememberedToken,
  isApiClientError,
  isConnectionError,
  isConnectionUiActive,
  LOCKED_EVENT,
  reportConnectionLost,
  server as serverApi,
  setServerInfo,
  setToken,
  settings as settingsApi,
  subscribeConnection,
  UNAUTHORIZED_EVENT,
} from '@/api';
import {
  forgetSignedOutPending,
  mayEndSessionWithChanges,
  pendingOnDevice,
  rememberSignedOutPending,
  wipeAccountQuietly,
} from '@/components/sync/syncGate';
import { DEFAULT_APP_SETTINGS } from '@/constants/settings';
import { T } from '@/constants/texts';
import { offline } from '@/offline';
import { isApp, lockedAtStart, readBinding } from '@/offline/session';
import { clearSignedOutAccountData } from '@/utils/deviceData';
import { getCurrentLocale, subscribe as subscribeLocale, tr } from '@/i18n/runtime';
import { deviceName } from '@/utils/platform';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export interface AuthState {
  status: AuthStatus;
  user: UserProfile | null;
  /** True when the current session was created with "Remember me". */
  sessionRemembered: boolean;
  /**
   * True when the server reported the session as locked (lock screen) when it was restored - a page
   * reload of a locked diary. Cleared by a successful `verifyPassword`.
   */
  sessionLocked: boolean;
  /**
   * Where the session comes from: 'server' (today: `me()`, login, registration) or 'cache' (the apps'
   * offline start from the encrypted session snapshot, OFFLINE-DESIGN.md section 4.7, until a `me()`
   * reaches the server). Absent counts as 'server'.
   */
  source?: 'server' | 'cache';
  /**
   * True while an offline start of the apps (section 4.7) may still put the cached diary on screen: from
   * the first render with a token and a binding until `offline.startFromCache` has resolved (or `me()`
   * decided the session). The connection display keeps the session spinner meanwhile instead of the full
   * "No connection" page, which would only flash - and move the focus to its heading - right before
   * the cached diary appears. Absent counts as false.
   */
  cacheStartPending?: boolean;
}

export interface AuthNotice {
  id: number;
  message: string;
  kind: 'info' | 'error';
  /** Set when the notice follows a logout the user asked for (the route guard then goes home, not to /login). */
  reason?: 'logout';
}

export interface LogoutOptions {
  /**
   * The toast that follows: 'auto' (default) - "You have logged out" for an account, "The tour has
   * ended" for the guest of the tour mode; 'none' - no toast, because the caller says itself what
   * happens next ("Create an account" opens the registration page).
   */
  notice?: 'auto' | 'none';
}

export interface AuthContextValue extends AuthState {
  login: (req: LoginRequest) => Promise<UserProfile>;
  register: (req: RegisterRequest) => Promise<UserProfile>;
  /**
   * Starts the tour mode ("Skip - just look around" in the phone app): POST /api/auth/guest with the
   * device name and the current UI language, the session stored like a login WITHOUT "Remember me"
   * (sessionStorage: closing the app ends the tour). Rejects with the API error - 404 where the
   * server has no guest mode (the desktop). Optional only for test doubles of the context.
   */
  startGuest?: () => Promise<UserProfile>;
  /** Ends the session on the server, clears the token, navigates home and leaves a notice (see LogoutOptions). */
  logout: (options?: LogoutOptions) => Promise<void>;
  /**
   * Forgets the session on this device only, without asking the server - for when the server has
   * already ended it (the account was deleted): clears the token and becomes anonymous. No
   * "logged out" notice and no navigation: the caller says what happened and where to go.
   */
  endSession: () => void;
  /** Re-fetches the profile (after changing the name, for example). */
  refreshUser: () => Promise<void>;
  /**
   * Verifies the account password (lock screen). Resolves true/false for
   * right/wrong password; throws for other errors. The session is kept.
   */
  verifyPassword: (password: string) => Promise<boolean>;
  /**
   * Runs an API call that may answer 401 WRONG_PASSWORD without losing the
   * session (change password, delete account...). Rethrows the original error.
   */
  withPasswordCheck: <R>(fn: () => Promise<R>) => Promise<R>;
  /**
   * The lock screen's offline unlock (the device's own screen lock / Windows Hello, OFFLINE-DESIGN.md
   * section 5.7): clears the lock this session came back with, on this device only. The server session
   * stays as it was (a locked one answers 423 at the next upload and the password is asked once).
   * Optional only for test doubles of the context.
   */
  unlockOffline?: () => void;
  /** One-shot message produced by session loss; App shows it as a toast. */
  notice: AuthNotice | null;
  dismissNotice: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

let noticeCounter = 1;

/** Waits between retries of the initial session check (then it gives up and keeps the token). */
export const SESSION_CHECK_RETRY_DELAYS_MS: readonly number[] = [1000, 3000, 6000];

/** Errors that say nothing about the session itself: rate limit, server error, server unreachable. */
export function isTransientSessionError(e: unknown): boolean {
  if (!isApiClientError(e)) return true;
  return e.status === 0 || e.status === 429 || e.status >= 500;
}

/** True when this device may try an offline start (the apps, with a binding written by an earlier session). */
function cacheStartPossible(): boolean {
  return isApp() && readBinding() !== null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>(() => {
    const token = getToken();
    return {
      status: token ? 'loading' : 'anonymous',
      user: null,
      sessionRemembered: false,
      sessionLocked: false,
      source: 'server',
      // Decided before the first request: the connection page must not get a single frame when the
      // cached diary may follow (the first `me()` failure already flips the connection store).
      cacheStartPending: !!token && cacheStartPossible(),
    };
  });
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  // Bumped by every successful `me()`, login, registration and profile refresh: the offline engine is
  // (re)started after each (section 4.7 "After every successful me() or login").
  const [serverSession, setServerSession] = useState(0);
  // The runtime locale, read here (the LanguageProvider sits below this provider): the guest's
  // display name is in the UI language and follows a language change.
  const locale = useSyncExternalStore(subscribeLocale, getCurrentLocale, getCurrentLocale);
  const serverInfo = useSyncExternalStore(subscribeConnection, getServerInfo, getServerInfo);
  const statusRef = useRef(state.status);
  statusRef.current = state.status;
  const sourceRef = useRef(state.source ?? 'server');
  sourceRef.current = state.source ?? 'server';
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = state.user?.id ?? null;
  const guestRef = useRef(false);
  guestRef.current = isGuestUser(state.user);
  const suppressUnauthorized = useRef(false);
  /**
   * The password of a login / registration the server has just accepted, held only until the offline
   * engine's start effect below runs for that session (the next render) and hands it to
   * `offline.start` once for the offline unlock by password (OFFLINE-DESIGN section 13, 2026-11-08).
   * The effect clears it on every run; nothing else reads it, and no state or storage ever holds it.
   */
  const loginPasswordRef = useRef<string | null>(null);

  const becomeAnonymous = useCallback(() => {
    setState({ status: 'anonymous', user: null, sessionRemembered: false, sessionLocked: false, source: 'server' });
  }, []);

  /**
   * A 401 ended the session: the login page says how many changes this account left on the device
   * (section 4.8, row "401"). With a session in memory the count comes from the engine's status. Without
   * one - the FIRST `me()` of a run answered 401 because the session was revoked while the app was closed
   * (a password change on another device) - the binding still names the account at this moment (the
   * engine's own listener clears it a tick later, together with the key, the snapshot and the cache), and
   * its outbox is counted without decrypting anything (the kept ciphertext uploads after the sign-in).
   */
  const rememberPendingOfLostSession = useCallback(() => {
    const uid = userIdRef.current;
    if (uid) {
      if (guestRef.current) return;
      const count = pendingOnDevice(uid);
      if (count > 0) rememberSignedOutPending(uid, count);
      return;
    }
    const bound = readBinding()?.userId;
    if (!bound) return;
    offline
      .otherAccountsWithPending(null)
      .then((list) => {
        const count = list.find((a) => a.userId === bound)?.count ?? 0;
        // A sign-in that came first owns the line (login / register forget it; this must not bring it back).
        if (count > 0 && statusRef.current !== 'authenticated') rememberSignedOutPending(bound, count);
      })
      .catch(() => undefined);
  }, []);

  /** The offline start has resolved (or will never run in this run): the connection page may show now. */
  const clearCacheStartPending = useCallback(() => {
    setState((s) => (s.cacheStartPending ? { ...s, cacheStartPending: false } : s));
  }, []);

  /**
   * Offline start of the apps (section 4.7 step 2): the engine opens the account's database with the
   * key kept by DPAPI / the Keystore and decrypts the session snapshot. Resolves true when the app now
   * runs from the cache.
   */
  const startFromCache = useCallback(async (): Promise<boolean> => {
    try {
      let res;
      try {
        res = await offline.startFromCache({ token: getToken() });
      } catch {
        return false;
      }
      if (!res.ok) return false;
      const snap = res.snapshot;
      // The facade needs the server's self-description (`offlineSync`); the snapshot kept it.
      if (!getServerInfo()) setServerInfo({ ...snap.serverInfo } as ServerInfo);
      let autoLockMinutes = DEFAULT_APP_SETTINGS.autoLockMinutes;
      try {
        const cached = await settingsApi.get();
        if (typeof cached?.autoLockMinutes === 'number') autoLockMinutes = cached.autoLockMinutes;
      } catch {
        /* not cached yet: the default applies */
      }
      const locked = lockedAtStart(snap, Date.now(), autoLockMinutes);
      if (statusRef.current === 'authenticated' && sourceRef.current === 'server') return true;
      // One update: the cached diary and the bar replace the spinner, with no frame of the page between.
      setState({ status: 'authenticated', user: snap.user, sessionRemembered: snap.rememberMe, sessionLocked: locked, source: 'cache' });
      return true;
    } finally {
      // A start that did not bring the diary (no key, no snapshot, unreadable): the page may show now.
      clearCacheStartPending();
    }
  }, [clearCacheStartPending]);

  // Initial session check --------------------------------------------------
  // Only 401 means the session is gone. A busy server (429 from the auth rate limit - e.g. several
  // quick reloads while switching languages), a server error or an unreachable server (status 0,
  // e.g. the sidecar still starting) is retried; if it still fails the token is KEPT, so the next
  // start restores the session instead of silently signing the device out.
  //
  // An unreachable server (`isConnectionError`: no network, the hosting platform's proxy answering
  // for a server that is down) is different once the retries are used up: the status stays 'loading'
  // - the "No connection to the diary server" screen is over the spinner (the api client reported the
  // failure to the connection store) - and its Retry, once it reaches the server, bumps
  // `connectionAttempt`, which runs this check again. No duplicate retry loop lives in the UI.
  //
  // The apps' offline start (section 4.7): the FIRST failure that cannot reach the server tries the
  // cache start at once; a session started from the cache keeps this check running in the background
  // and on every reconnect (the guard below lets it through) until the server answers.
  const connectionAttempt = useSyncExternalStore(subscribeConnection, getConnectionAttempt, getConnectionAttempt);
  useEffect(() => {
    if (!getToken()) return;
    // A reconnect only matters to a check that gave up: a session that is already in does not look
    // again - unless it runs from the cache and still waits for the server.
    if (connectionAttempt > 0 && statusRef.current === 'authenticated' && sourceRef.current !== 'cache') return;
    let cancelled = false;
    let triedCache = false;
    (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const me = await authApi.me();
          if (cancelled) return;
          const fromCache = sourceRef.current === 'cache' && statusRef.current === 'authenticated';
          const serverLocked = me.session.locked === true;
          setState((prev) => ({
            status: 'authenticated',
            user: me.user,
            sessionRemembered: me.session.rememberMe,
            // A session that ran from the cache keeps what is on screen: its lock state stays the
            // device's (a server lock shows the lock screen over it, below), never an unmount.
            sessionLocked: fromCache ? prev.sessionLocked : serverLocked,
            source: 'server',
          }));
          setServerSession((n) => n + 1);
          if (fromCache) {
            if (serverLocked) window.dispatchEvent(new CustomEvent(LOCKED_EVENT));
            // The server's own self-description replaces the snapshot's.
            serverApi
              .info()
              .then((info) => {
                if (info && typeof info === 'object') setServerInfo(info);
              })
              .catch(() => undefined);
          }
          return;
        } catch (e) {
          if (cancelled) return;
          // 401 already cleared the token (client) and fired UNAUTHORIZED_EVENT.
          if (isApiClientError(e) && e.status === 401) {
            becomeAnonymous();
            return;
          }
          if (!triedCache && isConnectionError(e) && statusRef.current !== 'authenticated' && cacheStartPossible()) {
            triedCache = true;
            await startFromCache();
            if (cancelled) return;
          } else if (!triedCache && isConnectionError(e)) {
            // No offline start in this run (the binding went meanwhile): nothing holds the page back.
            clearCacheStartPending();
          }
          const transient = isTransientSessionError(e);
          if (transient && attempt < SESSION_CHECK_RETRY_DELAYS_MS.length) {
            await new Promise((resolve) => setTimeout(resolve, SESSION_CHECK_RETRY_DELAYS_MS[attempt]));
            if (cancelled) return;
            continue;
          }
          if (sourceRef.current === 'cache' && statusRef.current === 'authenticated') {
            // Running from the cache: the server stays out of reach (or answered oddly). Keep going;
            // the next reconnect runs this check again.
            if (isConnectionError(e)) reportConnectionLost();
            return;
          }
          if (isConnectionError(e) && isConnectionUiActive()) {
            // The server cannot be reached: keep the token AND the 'loading' status; the connection
            // screen (with Retry) is shown instead of a toast, and a reconnect re-runs this effect.
            // (Only while that screen exists - the ConnectionProvider is mounted; a tree without it
            // must not hang on the spinner, so it gets the notice below.)
            reportConnectionLost();
            return;
          }
          if (!transient) clearToken();
          setNotice({ id: noticeCounter++, message: isApiClientError(e) ? e.message : T.noServer, kind: 'error' });
          becomeAnonymous();
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [becomeAnonymous, clearCacheStartPending, connectionAttempt, startFromCache]);

  // Offline engine ---------------------------------------------------------------
  // Started after every successful me() / login / registration on a server that offers offline mode
  // (and once the server's self-description arrives, when it came after the session). A session from
  // the cache already runs the engine; the guest never gets one. Signed out: the engine stops (a
  // sign-out or an account deletion has wiped the device's copy already, a 401 tore it down itself).
  const offlineOffered = serverInfo?.offlineSync === 1;
  const sessionUserId = state.user?.id ?? null;
  const sessionGuest = isGuestUser(state.user);
  const sessionSource = state.source ?? 'server';
  useEffect(() => {
    // Consumed by exactly one run of this effect: the one that follows the login. A run that cannot
    // start the engine drops it (the wrap is then made at the next password check against the server).
    const password = loginPasswordRef.current;
    loginPasswordRef.current = null;
    if (state.status === 'anonymous') {
      if (offline.isActive()) void offline.stop();
      return;
    }
    if (state.status !== 'authenticated' || !state.user || sessionGuest || sessionSource === 'cache' || !offlineOffered) return;
    const user = state.user;
    void offline
      .start({ user, rememberMe: state.sessionRemembered, serverInfo: getServerInfo(), locked: state.sessionLocked, password: password ?? undefined })
      .then((outcome) => {
        if (outcome.enabled) forgetSignedOutPending();
      })
      .catch(() => undefined);
    // Re-run per session event, not per render of the state object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSession, offlineOffered, state.status, sessionUserId, sessionGuest, sessionSource]);

  // Session loss reported by the api client ----------------------------------
  useEffect(() => {
    // A suppressed 401 (a wrong password in verify / change password, account deletion) is not a lost
    // session: it must not reach the offline engine's own listener either, which would drop the cache,
    // the snapshot and the key. This listener is registered before the engine's (the engine starts
    // after the first me()), so it can stop the event for the listeners that follow.
    const stopSuppressed = (ev: Event) => {
      if (suppressUnauthorized.current) ev.stopImmediatePropagation();
    };
    const onUnauthorized = () => {
      if (suppressUnauthorized.current) return;
      const wasAuthenticated = statusRef.current === 'authenticated';
      rememberPendingOfLostSession();
      becomeAnonymous();
      if (wasAuthenticated) {
        setNotice({ id: noticeCounter++, message: T.sessionExpired, kind: 'info' });
      }
    };
    window.addEventListener(UNAUTHORIZED_EVENT, stopSuppressed, { capture: true });
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, stopSuppressed, { capture: true });
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, [becomeAnonymous, rememberPendingOfLostSession]);

  const login = useCallback(async (req: LoginRequest) => {
    const res = await authApi.login({ deviceName: deviceName(), ...req });
    setToken(res.token, !!res.rememberMe);
    forgetSignedOutPending();
    // The server accepted this password a moment ago: the engine's start (the effect above) wraps the offline key under it once.
    loginPasswordRef.current = req.password || null;
    setState({ status: 'authenticated', user: res.user, sessionRemembered: !!res.rememberMe, sessionLocked: false, source: 'server' });
    setServerSession((n) => n + 1);
    return res.user;
  }, []);

  const register = useCallback(async (req: RegisterRequest) => {
    const res = await authApi.register({ deviceName: deviceName(), ...req });
    setToken(res.token, !!res.rememberMe);
    forgetSignedOutPending();
    loginPasswordRef.current = req.password || null;
    setState({ status: 'authenticated', user: res.user, sessionRemembered: !!res.rememberMe, sessionLocked: false, source: 'server' });
    setServerSession((n) => n + 1);
    return res.user;
  }, []);

  const startGuest = useCallback(async () => {
    const res = await authApi.guest({ deviceName: deviceName(), language: getCurrentLocale() });
    // A guest is never remembered, whatever the answer says: the token lives in sessionStorage only.
    setToken(res.token, false);
    const user: UserProfile = { ...res.user, guest: true };
    setState({ status: 'authenticated', user, sessionRemembered: false, sessionLocked: false, source: 'server' });
    return withGuestName(user, getCurrentLocale());
  }, []);

  const logout = useCallback(
    async ({ notice: noticeMode = 'auto' }: LogoutOptions = {}) => {
      const wasGuest = guestRef.current;
      const userId = userIdRef.current;
      // Changes still on this device (section 4.8): uploaded first when online; when some are left,
      // the user decides before anything is signed out ("Stay signed in" / "Review" end here).
      if (!wasGuest && userId && !(await mayEndSessionWithChanges(userId))) return;
      suppressUnauthorized.current = true;
      try {
        if (getToken()) await authApi.logout();
      } catch {
        /* the session is dropped locally regardless */
      } finally {
        suppressUnauthorized.current = false;
      }
      clearToken();
      // Diary-derived text this device kept for the account (recent search questions) goes too.
      clearSignedOutAccountData(userId);
      // The offline copy of the account on this device (outbox, notes, cache, key) - explicitly, after the question.
      if (!wasGuest && userId) await wipeAccountQuietly(userId);
      becomeAnonymous();
      if (noticeMode !== 'none') {
        // The guest never signed in: "The tour has ended", not "You have logged out".
        const message = wasGuest ? tr('mobile.guest.ended') : T.loggedOut;
        setNotice({ id: noticeCounter++, message, kind: 'info', reason: 'logout' });
      }
      navigate('/');
    },
    [becomeAnonymous, navigate],
  );

  const endSession = useCallback(() => {
    clearToken();
    clearSignedOutAccountData(userIdRef.current);
    becomeAnonymous();
  }, [becomeAnonymous]);

  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    const me = await authApi.me();
    setState({ status: 'authenticated', user: me.user, sessionRemembered: me.session.rememberMe, sessionLocked: me.session.locked === true, source: 'server' });
    setServerSession((n) => n + 1);
  }, []);

  const withPasswordCheck = useCallback(async <R,>(fn: () => Promise<R>): Promise<R> => {
    const token = getToken();
    const remembered = hasRememberedToken();
    suppressUnauthorized.current = true;
    try {
      return await fn();
    } catch (e) {
      if (isApiClientError(e) && e.status === 401) {
        if (e.code === 'WRONG_PASSWORD') {
          // The client cleared the token although the session is still valid.
          if (token) setToken(token, remembered);
        } else {
          // A real session loss (expired / revoked): the offline engine keeps the outbox (section 4.8).
          rememberPendingOfLostSession();
          void offline.onUnauthorized();
          becomeAnonymous();
          setNotice({ id: noticeCounter++, message: T.sessionExpired, kind: 'info' });
        }
      }
      throw e;
    } finally {
      suppressUnauthorized.current = false;
    }
  }, [becomeAnonymous, rememberPendingOfLostSession]);

  const verifyPassword = useCallback(
    async (password: string) => {
      try {
        const res = await withPasswordCheck(() => authApi.verifyPassword(password));
        // The right password also unlocked the session on the server.
        if (res.ok) {
          setState((s) => (s.sessionLocked ? { ...s, sessionLocked: false } : s));
          // ... and is in hand for the offline unlock: the engine refreshes its wrap (no-op when it does not run).
          void offline.refreshPasswordWrap(password).catch(() => undefined);
        }
        return !!res.ok;
      } catch (e) {
        if (isApiClientError(e) && e.code === 'WRONG_PASSWORD') return false;
        throw e;
      }
    },
    [withPasswordCheck],
  );

  const unlockOffline = useCallback(() => {
    setState((s) => (s.sessionLocked ? { ...s, sessionLocked: false } : s));
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  // The guest's profile is kept as the server sent it (no name); the name is added on the way out, so
  // it follows the UI language.
  const user = useMemo(() => (state.user ? withGuestName(state.user, locale) : null), [state.user, locale]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      user,
      login,
      register,
      startGuest,
      logout,
      endSession,
      refreshUser,
      verifyPassword,
      withPasswordCheck,
      unlockOffline,
      notice,
      dismissNotice,
    }),
    [state, user, login, register, startGuest, logout, endSession, refreshUser, verifyPassword, withPasswordCheck, unlockOffline, notice, dismissNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** True for the temporary guest account of the tour mode (phone app): nothing it writes is saved. */
export function isGuestUser(user: Pick<UserProfile, 'guest'> | null | undefined): boolean {
  return user?.guest === true;
}

/**
 * The profile as the UI shows it: the guest of the tour mode has no name of its own (the server
 * gives it an empty first name), so wherever a first name is expected - "Hello {firstName}" on the
 * home page - it is called "Guest" in the given language (mobile.guest.name). Other profiles, and a
 * guest that somehow has a name, are returned unchanged.
 */
export function withGuestName(user: UserProfile, locale: Locale): UserProfile {
  if (!isGuestUser(user) || user.firstName.trim() !== '') return user;
  return { ...user, firstName: t(locale, 'mobile.guest.name') };
}

/** Access the auth state and actions. Must be used inside AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
