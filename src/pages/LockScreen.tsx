/**
 * Lock screen: a non-dismissable modal (no Escape, no backdrop close, no
 * close button) asking for the account password. While locked the app root
 * (#app-root) is `inert`, so screen readers cannot read behind the dialog.
 * A wrong password is shown at the field and announced inside the dialog
 * (the global live region is inert too). The "Log out" button ends the
 * session instead (with changes still on this device it asks first, without
 * "Review": src/components/sync/syncGate.ts).
 *
 * Automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md section 5.7 and
 * the 2026-11-08 note in section 13): without a connection the server cannot
 * check the password, so the screen offers two ways that unlock this device's
 * screen only. (1) The password, checked on the device against the wrap the
 * engine kept (src/offline/password-wrap.ts) - the form stays as it is online,
 * with the note "No connection: your password is checked on this device."; a
 * wrong password shows the usual error, and from the third wrong one on the
 * field also says how long to wait. (2) The device's own user check (the phone's
 * screen lock, Windows Hello, Touch ID: the DeviceUserCheck seam), "Unlock with
 * this device's screen lock", gone after three cancelled or failed checks. Only
 * when NEITHER exists (no wrap on this device and no usable check) it says
 * "Unlocking needs a connection to the diary server. What you wrote is saved on
 * this device." A lock that comes after an offline unlock (the server answered
 * 423 to an upload) asks for the password "to upload your changes" - online.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Dialog } from '@/components/a11y/Dialog';
import { LiveRegion } from '@/components/a11y/LiveRegion';
import { APP_ROOT_ID, MAIN_ID } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PAGE_TITLE_ID } from '@/components/ui/PageTitle';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';
import { getPhoneSecurity, useLock } from '@/context/LockContext';
import { useOfflineNow } from '@/components/sync/hooks';
import { setLockScreenUp } from '@/components/sync/syncGate';
import { offline } from '@/offline';
import { getOfflinePlatform } from '@/offline/seams';
import { tr } from '@/i18n/runtime';
import { errorMessage } from '@/utils/errors';

/** Cancelled or failed device checks before the lock screen falls back to "needs a connection". */
export const OFFLINE_UNLOCK_ATTEMPTS = 3;

export default function LockScreen() {
  const { locked, unlock, unlockOffline, uploadPrompt } = useLock();
  const { verifyPassword, logout, user } = useAuth();
  const { announce } = useAnnouncer();
  const base = useId();
  const descId = `lock-${base}-desc`;
  const passwordId = `lock-${base}-password`;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Phone (Android app) only: "Unlock with fingerprint or face" - a second button next to the
  // password, shown while the setting is on and the phone can show a prompt. It never replaces the
  // password (the form stays); see mobile/platform/biometric.ts. `__MOBILE__` is a build-time
  // constant: false on the desktop (this folds to `null`), not defined under the root vitest config.
  const biometric = typeof __MOBILE__ !== 'undefined' && __MOBILE__ ? (getPhoneSecurity()?.biometric ?? null) : null;
  const [biometricReady, setBiometricReady] = useState(false);
  useEffect(() => {
    if (!locked || !biometric || !getPhoneSecurity()?.get().biometricUnlock) {
      setBiometricReady(false);
      return;
    }
    let cancelled = false;
    void biometric.isAvailable().then((available) => {
      if (!cancelled) setBiometricReady(available);
    });
    return () => {
      cancelled = true;
    };
  }, [locked, biometric]);

  const onBiometric = async () => {
    if (busy || !biometric) return;
    setBusy(true);
    setError(null);
    try {
      const result = await biometric.unlock();
      if (result === 'unlocked') {
        unlock();
        announce(T.unlocked, 'polite');
      } else if (result === 'failed' || result === 'not-enrolled') {
        if (result === 'not-enrolled') setBiometricReady(false);
        setError(tr('mobile.lock.biometricFailed'));
        document.getElementById(passwordId)?.focus();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Offline unlock (section 5.7): the device's own user check, while the server cannot be reached.
  const offlineNow = useOfflineNow();
  const userCheck = getOfflinePlatform().userCheck ?? null;
  const [deviceReady, setDeviceReady] = useState(false);
  // True once the device answered whether its user check is available (the fallback text waits for it).
  const [deviceChecked, setDeviceChecked] = useState(false);
  const [deviceFailures, setDeviceFailures] = useState(0);
  useEffect(() => {
    if (!locked || !offlineNow || !userCheck) {
      setDeviceReady(false);
      setDeviceChecked(!userCheck);
      return;
    }
    let cancelled = false;
    setDeviceChecked(false);
    userCheck
      .available()
      .then((available) => {
        if (!cancelled) setDeviceReady(available);
      })
      .catch(() => {
        if (!cancelled) setDeviceReady(false);
      })
      .finally(() => {
        if (!cancelled) setDeviceChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locked, offlineNow, userCheck]);
  const showDeviceUnlock = offlineNow && deviceReady && deviceFailures < OFFLINE_UNLOCK_ATTEMPTS && !!unlockOffline;

  // Offline unlock by password (section 13, 2026-11-08): the engine says whether a wrap exists on this
  // device (null until it answered). The note under the password field shows while it does; the
  // "needs a connection" fallback only when neither this nor the device check can unlock.
  const [passwordReady, setPasswordReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (!locked || !offlineNow || !unlockOffline) {
      setPasswordReady(null);
      return;
    }
    let cancelled = false;
    offline
      .canUnlockWithPassword()
      .then((ready) => {
        if (!cancelled) setPasswordReady(ready);
      })
      .catch(() => {
        if (!cancelled) setPasswordReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locked, offlineNow, unlockOffline]);
  const showPasswordOffline = offlineNow && passwordReady === true && !!unlockOffline;
  const showOfflineFallback = offlineNow && deviceChecked && !showDeviceUnlock && passwordReady === false;

  const onDeviceUnlock = async () => {
    if (busy || !userCheck || !unlockOffline) return;
    setBusy(true);
    setError(null);
    try {
      const result = await userCheck.verify(tr('shell.sync.lock.deviceReason'));
      if (result === 'ok') {
        unlockOffline();
        announce(T.unlocked, 'polite');
      } else if (result === 'unavailable') {
        setDeviceReady(false);
      } else {
        setDeviceFailures((n) => n + 1);
      }
    } catch {
      setDeviceFailures((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  // The sign-out question offers no "Review" while the lock screen is up.
  useEffect(() => {
    setLockScreenUp(locked);
    return () => setLockScreenUp(false);
  }, [locked]);

  // Hide the application from assistive technology while locked.
  useEffect(() => {
    const root = document.getElementById(APP_ROOT_ID);
    if (!root) return;
    if (locked) root.setAttribute('inert', '');
    else root.removeAttribute('inert');
    return () => root.removeAttribute('inert');
  }, [locked]);

  // Fresh form on every lock.
  useEffect(() => {
    if (locked) {
      setPassword('');
      setError(null);
      setBusy(false);
      setDeviceFailures(0);
    }
  }, [locked]);

  // After unlocking, the dialog gives focus back to where it was before the lock. A lock that came
  // back with a reload had no such place, and focus would be left on <body> (screen readers start
  // over at the top): the page heading gets it instead, or the main region. Runs after the dialog's
  // own effect (children first) and after the app root lost `inert` (cleanups run first).
  const wasLocked = useRef(locked);
  useEffect(() => {
    if (wasLocked.current && !locked) {
      const active = document.activeElement;
      if (!active || active === document.body) {
        (document.getElementById(PAGE_TITLE_ID) ?? document.getElementById(MAIN_ID))?.focus();
      }
    }
    wasLocked.current = locked;
  }, [locked]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      setError(T.fieldRequired(T.password));
      document.getElementById(passwordId)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (offlineNow && unlockOffline) {
        // No connection: the password is checked on this device and unlocks this device's screen only
        // (like the device check); the server session stays as it was.
        const res = await offline.unlockWithPassword(password);
        if (res.outcome === 'ok') {
          unlockOffline();
          announce(T.unlocked, 'polite');
          return;
        }
        setPasswordReady(res.outcome !== 'unavailable');
        const wait = res.waitSeconds > 0 ? tr('shell.sync.lock.wait', { seconds: res.waitSeconds }) : null;
        if (res.outcome === 'unavailable') setError(tr('shell.sync.lock.offline'));
        else if (res.outcome === 'wait') setError(wait);
        else setError(wait ? `${T.lockWrongPassword} ${wait}` : T.lockWrongPassword);
        setPassword('');
        document.getElementById(passwordId)?.focus();
        return;
      }
      const ok = await verifyPassword(password);
      if (ok) {
        unlock();
        announce(T.unlocked, 'polite');
      } else {
        setError(T.lockWrongPassword);
        setPassword('');
        document.getElementById(passwordId)?.focus();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={locked}
      onClose={() => undefined}
      title={T.lockTitle}
      size="sm"
      className="dialog--lock"
      closeOnEscape={false}
      closeOnBackdrop={false}
      showCloseButton={false}
      describedBy={descId}
    >
      <p id={descId}>{uploadPrompt ? tr('shell.sync.lock.passwordToUpload') : T.lockDescription}</p>
      {user && <p className="text-muted">{T.greetingShort(user.firstName)}</p>}
      {showOfflineFallback && (
        <p className="text-muted" data-testid="lock-offline-fallback">
          {tr('shell.sync.lock.offline')}
        </p>
      )}
      <form className="form" onSubmit={onSubmit} noValidate>
        {/* The offline note is the field's hint: inside the dialog and in the field's aria-describedby. */}
        <Field id={passwordId} label={T.password} error={error} hint={showPasswordOffline ? <span data-testid="lock-password-offline">{tr('shell.sync.lock.passwordOffline')}</span> : undefined} required>
          {(a11y) => (
            <PasswordInput
              {...a11y}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.currentTarget.value);
                if (error) setError(null);
              }}
            />
          )}
        </Field>
        <LiveRegion politeness="assertive" message={error ?? ''} />
        <div className="form__actions">
          <Button type="submit" loading={busy}>
            {T.unlock}
          </Button>
          {showDeviceUnlock && (
            <Button variant="secondary" disabled={busy} onClick={() => void onDeviceUnlock()}>
              {tr('shell.sync.lock.deviceUnlock')}
            </Button>
          )}
          {biometricReady && (
            <Button variant="secondary" disabled={busy} onClick={() => void onBiometric()}>
              {tr('mobile.lock.biometric')}
            </Button>
          )}
          <Button variant="ghost" onClick={() => void logout()}>
            {T.logout}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
