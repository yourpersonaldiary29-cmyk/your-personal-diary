/**
 * Lines about changes that wait on this device while nobody is signed in (docs/android-tasks/
 * OFFLINE-DESIGN.md sections 4.7-4.8):
 *  - the login page after a 401: "Sign in again to upload the {n} changes saved on this device." (the
 *    outbox was kept; the same account signs in, gets its key back and the upload goes on);
 *  - the "No connection to the diary server" page when any outbox exists on the device: "Changes written
 *    on this device are waiting. They will be uploaded after you sign in." - no account is named.
 * Both render nothing in every other case (no outbox, offline mode never used, page tests).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert } from '@/components/ui/Alert';
import { offline } from '@/offline';
import { tr } from '@/i18n/runtime';
import { getSignedOutPending, subscribeSignedOutPending } from './syncGate';

/** The login page's line after a 401 that left changes on this device. */
export function SignedOutPendingNotice() {
  const pending = useSyncExternalStore(subscribeSignedOutPending, getSignedOutPending, getSignedOutPending);
  if (!pending || pending.count <= 0) return null;
  return (
    <Alert kind="info" data-testid="login-waiting">
      {tr('shell.sync.login.waiting', { count: pending.count })}
    </Alert>
  );
}

/** The connection page's neutral line when any account's outbox waits on this device. */
export function DeviceWaitingNotice() {
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    let cancelled = false;
    offline
      .otherAccountsWithPending(null)
      .then((list) => {
        if (!cancelled) setWaiting(list.some((a) => a.count > 0));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  if (!waiting) return null;
  return (
    <p className="no-connection__text" data-testid="no-connection-waiting">
      {tr('shell.sync.noConnection.waiting')}
    </p>
  );
}
