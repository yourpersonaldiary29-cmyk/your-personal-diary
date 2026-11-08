/**
 * When offline mode is on (section 4.1). All of the following must hold:
 *  - `apiBaseKind()` is the server (the Windows and Android apps), or same-origin with the server
 *    describing itself as hosted (the web UI served by it; the developer override against a hosted
 *    server behaves like the web);
 *  - `ServerInfo.offlineSync === 1` (the capability flag; the kill switch removes it);
 *  - the user is authenticated and not a guest, and the account offline key is in memory - the
 *    engine then "arms" itself for that account (`setArmedAccount`);
 *  - `window.isSecureContext && crypto.subtle` exist (`cryptoAvailable`).
 * Otherwise the facade passes every call straight to today's functions: local builds, page tests and
 * old servers are untouched.
 */
import { apiBaseKind } from '@/api/client';
import { getServerInfo } from '@/api/connection';
import { cryptoAvailable } from './crypto';

let armedUserId: string | null = null;

/** True when this build and this server allow offline work (independent of the signed-in user). */
export function offlineModeSupported(): boolean {
  const info = getServerInfo();
  if (info?.offlineSync !== 1) return false;
  const kind = apiBaseKind();
  const serverUi = kind === 'server' || ((kind === 'same-origin' || kind === 'override') && info.mode === 'hosted');
  return serverUi && cryptoAvailable();
}

/** The engine: armed for `userId` (the AOK is in memory), or disarmed (null). */
export function setArmedAccount(userId: string | null): void {
  armedUserId = userId;
}

/** The account the engine is armed for, or null. */
export function armedAccount(): string | null {
  return armedUserId;
}

/** True when the facade must queue writes and serve cached reads (section 4.1). */
export function isOfflineEnabled(): boolean {
  return armedUserId !== null && offlineModeSupported();
}
