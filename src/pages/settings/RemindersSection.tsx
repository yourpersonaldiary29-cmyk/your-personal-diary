/**
 * "Reminders" card: the global on/off switch for habit reminders. The reminders are
 * local notifications only (useReminders polls the local server; the Android app
 * schedules system notifications instead); nothing leaves the device.
 *
 * Phone (Android app) only: the notification permission of Android 13+ is asked HERE, with an
 * explanation and a button - never at start-up - and a denial is explained; plus the phone
 * setting "Show habit names in notifications" (off by default: a reminder on the lock screen
 * then says only that it is time for a habit).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { PATHS } from '@/constants/routes';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useSettings } from '@/context/SettingsContext';
import { getPhoneReminders, type PhoneNotificationPermission, type PhoneReminders } from '@/hooks/useReminders';
import { tr } from '@/i18n/runtime';
import { errorMessage } from '@/utils/errors';
import { ST } from './texts';
import { useSettingsSaver } from './useSettingsSaver';

/**
 * Phone only: the notification permission and the "show habit names" setting. Module-private on
 * purpose: referenced only behind `isMobileUi()`, so the desktop bundle drops it entirely.
 */
function PhoneRemindersBlock({ phone }: { phone: PhoneReminders }) {
  const { announce } = useAnnouncer();
  const [permission, setPermission] = useState<PhoneNotificationPermission | null>(null);
  const [showNames, setShowNames] = useState(phone.getShowNames());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      setShowNames(phone.getShowNames());
      void phone.permission().then(
        (next) => {
          if (!cancelled) setPermission(next);
        },
        () => undefined,
      );
    };
    refresh();
    const unsubscribe = phone.subscribe(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [phone]);

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await phone.requestPermission();
      setPermission(next);
      announce(next === 'granted' ? tr('mobile.reminders.granted') : tr('mobile.reminders.denied'), 'polite');
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      announce(message, 'assertive');
    } finally {
      setBusy(false);
    }
  };

  const onShowNames = async (checked: boolean) => {
    setShowNames(checked);
    setError(null);
    try {
      await phone.setShowNames(checked);
      announce(tr('mobile.security.saved'), 'polite');
    } catch (e) {
      setShowNames(!checked);
      const message = errorMessage(e);
      setError(message);
      announce(message, 'assertive');
    }
  };

  return (
    <div className="stack-sm" data-testid="phone-reminders">
      {error && <Alert kind="error">{error}</Alert>}
      {permission === 'granted' && <p className="text-muted text-small">{tr('mobile.reminders.granted')}</p>}
      {permission === 'prompt' && (
        <>
          <p>{tr('mobile.reminders.permissionText')}</p>
          <div className="cluster">
            <Button variant="secondary" loading={busy} onClick={() => void allow()}>
              {tr('mobile.reminders.allow')}
            </Button>
          </div>
        </>
      )}
      {permission === 'denied' && (
        <Alert kind="warning" role="none">
          {tr('mobile.reminders.denied')}
        </Alert>
      )}
      <Checkbox
        id="settings-reminder-names"
        label={tr('mobile.reminders.showNames')}
        hint={tr('mobile.reminders.showNamesHint')}
        checked={showNames}
        onChange={(checked) => void onShowNames(checked)}
      />
    </div>
  );
}

export function RemindersSection() {
  const { settings } = useSettings();
  const { save, error } = useSettingsSaver();
  // `__MOBILE__` is a build-time constant (false on the desktop, where this folds to `null` and the
  // phone block is dropped from the bundle); under the root vitest config it is not defined.
  const phone = typeof __MOBILE__ !== 'undefined' && __MOBILE__ ? getPhoneReminders() : null;

  const onToggle = (checked: boolean) => {
    void save({ remindersEnabled: checked }, checked ? ST.remindersOn : ST.remindersOff);
  };

  return (
    <Card title={ST.reminders}>
      <div className="stack">
        {error && <Alert kind="error">{error}</Alert>}
        <Checkbox id="settings-reminders" label={ST.remindersEnabled} hint={ST.remindersHint} checked={settings.remindersEnabled} onChange={onToggle} />
        {phone && settings.remindersEnabled && <PhoneRemindersBlock phone={phone} />}
        <p className="text-muted">
          {ST.remindersExplanation} <Link to={PATHS.habits}>{ST.habitsLink}</Link>
        </p>
      </div>
    </Card>
  );
}
