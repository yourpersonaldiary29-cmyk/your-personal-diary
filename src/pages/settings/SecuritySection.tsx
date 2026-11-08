/**
 * "Security" card: auto-lock delay and a "lock now" button.
 * The auto-lock timer itself runs in App (useAutoLock) from settings.autoLockMinutes.
 *
 * Phone (Android app) only: the device settings "Lock when I leave the app" (default on), "Hide
 * content in recent apps and block screenshots" (default on) and - when the build offers it -
 * "Unlock with fingerprint or face", which asks for the account password once to turn on.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { useSyncEnabled } from '@/components/sync/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Select, type SelectOption } from '@/components/ui/Select';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { getPhoneSecurity, useLock, type PhoneSecurity, type PhoneSecurityPrefs } from '@/context/LockContext';
import { useSettings } from '@/context/SettingsContext';
import { tr } from '@/i18n/runtime';
import { isApp } from '@/offline/session';
import { errorMessage } from '@/utils/errors';
import { ST } from './texts';
import { useSettingsSaver } from './useSettingsSaver';

/**
 * Phone only: the device's security settings. Module-private on purpose: referenced only behind
 * `isMobileUi()`, so the desktop bundle drops it entirely.
 */
function PhoneSecurityBlock({ security }: { security: PhoneSecurity }) {
  const { announce } = useAnnouncer();
  const [prefs, setPrefs] = useState<PhoneSecurityPrefs>(security.get());
  const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(null);
  const [askPassword, setAskPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => security.subscribe(setPrefs), [security]);
  useEffect(() => {
    const biometric = security.biometric;
    if (!biometric) return;
    let cancelled = false;
    void biometric.isAvailable().then((available) => {
      if (!cancelled) setBiometricAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, [security]);

  const saved = () => announce(tr('mobile.security.saved'), 'polite');
  const failed = (e: unknown) => {
    const message = errorMessage(e);
    setError(message);
    announce(message, 'assertive');
  };
  const toggle = (change: (value: boolean) => Promise<void>) => (value: boolean) => {
    setError(null);
    change(value).then(saved, failed);
  };

  const onBiometric = (checked: boolean) => {
    const biometric = security.biometric;
    if (!biometric) return;
    setError(null);
    if (!checked) {
      biometric.disable().then(saved, failed);
      return;
    }
    // Turning it on needs the account password once: the core issues the unlock token for it.
    setAskPassword(true);
  };

  const enableBiometric = async (e: FormEvent) => {
    e.preventDefault();
    const biometric = security.biometric;
    if (!biometric || busy) return;
    if (!password) {
      setError(T.fieldRequired(T.password));
      document.getElementById('settings-biometric-password')?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await biometric.enable(password);
      setPassword('');
      setAskPassword(false);
      if (ok) saved();
      else announce(ST.cancelled, 'polite');
    } catch (err) {
      failed(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-sm" data-testid="phone-security">
      {error && <Alert kind="error">{error}</Alert>}
      <Checkbox
        id="settings-lock-on-leave"
        label={tr('mobile.security.lockOnLeave')}
        hint={tr('mobile.security.lockOnLeaveHint')}
        checked={prefs.lockOnLeave}
        onChange={toggle((value) => security.setLockOnLeave(value))}
      />
      <Checkbox
        id="settings-privacy-screen"
        label={tr('mobile.security.privacyScreen')}
        hint={tr('mobile.security.privacyScreenHint')}
        checked={prefs.privacyScreen}
        onChange={toggle((value) => security.setPrivacyScreen(value))}
      />
      {security.biometric && (
        <>
          <Checkbox
            id="settings-biometric"
            label={tr('mobile.security.biometric')}
            hint={biometricAvailable === false ? tr('mobile.security.biometricUnavailable') : tr('mobile.security.biometricHint')}
            checked={prefs.biometricUnlock}
            disabled={biometricAvailable !== true}
            onChange={onBiometric}
          />
          {askPassword && (
            <form className="form" onSubmit={(e) => void enableBiometric(e)} noValidate>
              <Field id="settings-biometric-password" label={T.password} required>
                {(a11y) => (
                  <PasswordInput {...a11y} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
                )}
              </Field>
              <div className="form__actions">
                <Button type="submit" loading={busy}>
                  {tr('mobile.security.biometric')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAskPassword(false);
                    setPassword('');
                  }}
                >
                  {T.cancel}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

/** Auto-lock choices in minutes (0 = off). */
export const AUTO_LOCK_MINUTES = [0, 1, 5, 10, 15, 30, 60] as const;

/** Auto-lock select options in the current UI language. */
export function autoLockPresets(): SelectOption[] {
  return AUTO_LOCK_MINUTES.map((minutes) => ({ value: String(minutes), label: minutes === 0 ? ST.autoLockOff : ST.minutes(minutes) }));
}

/** The select options, extended with the current value when it is not a preset. */
export function autoLockOptions(current: number): SelectOption[] {
  const presets = autoLockPresets();
  const value = String(current);
  if (presets.some((o) => o.value === value)) return presets;
  return [...presets, { value, label: ST.minutes(current) }];
}

export function SecuritySection() {
  const { settings } = useSettings();
  const { lock } = useLock();
  const { save, error } = useSettingsSaver();
  const options = autoLockOptions(settings.autoLockMinutes);
  // `__MOBILE__` is a build-time constant (false on the desktop, where this folds to `null` and the
  // phone block is dropped from the bundle); under the root vitest config it is not defined.
  const security = typeof __MOBILE__ !== 'undefined' && __MOBILE__ ? getPhoneSecurity() : null;
  // Offline mode on an app keeps an encrypted copy on this device (OFFLINE-DESIGN.md section 5.5): signing out deletes it.
  const offlineCopy = useSyncEnabled() && isApp();

  const onAutoLock = (value: string) => {
    const label = options.find((o) => o.value === value)?.label ?? value;
    void save({ autoLockMinutes: Number(value) }, ST.autoLockChanged(label));
  };

  return (
    <Card
      title={ST.security}
      actions={
        <Button variant="secondary" onClick={() => lock()}>
          {ST.lockNow}
        </Button>
      }
    >
      <div className="stack">
        {error && <Alert kind="error">{error}</Alert>}
        <Select
          id="settings-auto-lock"
          label={ST.autoLock}
          hint={ST.autoLockHint}
          options={options}
          value={String(settings.autoLockMinutes)}
          onChange={onAutoLock}
        />
        {security && <PhoneSecurityBlock security={security} />}
        <p className="text-muted text-small">{ST.lockNowHint}</p>
        {offlineCopy && <p className="text-muted text-small">{tr('shell.sync.uninstallHint')}</p>}
      </div>
    </Card>
  );
}
