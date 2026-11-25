/**
 * Phone app, Habits page: ONE quiet notice while a habit has a reminder but the phone does not allow
 * notifications - a user who turned a reminder on before version 1.1.0 was never asked.
 *  - 'prompt': the explanation and the button "Allow notifications"; the system dialog opens only
 *    from that tap, never by itself;
 *  - 'denied': the sentence with the path in the phone settings;
 *  - 'granted', or the phone did not answer: nothing.
 * The page renders it only in the phone app, while reminders are on and a habit has one.
 * Texts: 'mobile.reminders.*' (the same as the Reminders card in Settings).
 */
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { askPhoneNotificationPermission, type PhoneNotificationPermission, type PhoneReminders } from '@/hooks/useReminders';
import { tr } from '@/i18n/runtime';
import { errorMessage } from '@/utils/errors';

export interface PhoneRemindersNoticeProps {
  phone: PhoneReminders;
  /** Called when the button is gone after an answer ('granted' / 'denied'): the page moves the focus. */
  onSettled?: () => void;
}

export function PhoneRemindersNotice({ phone, onSettled }: PhoneRemindersNoticeProps) {
  const { announce } = useAnnouncer();
  const [permission, setPermission] = useState<PhoneNotificationPermission | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void phone.permission().then(
        (next) => {
          if (!cancelled) setPermission(next);
        },
        () => undefined,
      );
    };
    // Back from the phone settings (the app was in the background): notifications may be allowed now.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    const unsubscribe = phone.subscribe(refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phone]);

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    const next = await askPhoneNotificationPermission(phone);
    setBusy(false);
    if (next === null) {
      announce(errorMessage(null), 'assertive');
      return;
    }
    setPermission(next);
    // 'prompt' after "Don't allow" (Android's first refusal): the button stays, and the sentence
    // with the settings path would not match the screen - so nothing is announced then.
    if (next === 'prompt') return;
    announce(next === 'granted' ? tr('mobile.reminders.granted') : tr('mobile.reminders.denied'), 'polite');
    onSettled?.();
  };

  if (permission === 'prompt') {
    return (
      <Alert kind="info" role="none" data-testid="phone-reminders-notice">
        <p>{tr('mobile.reminders.permissionText')}</p>
        <div className="cluster">
          <Button variant="secondary" loading={busy} onClick={() => void allow()}>
            {tr('mobile.reminders.allow')}
          </Button>
        </div>
      </Alert>
    );
  }
  if (permission === 'denied') {
    return (
      <Alert kind="warning" role="none" data-testid="phone-reminders-notice">
        {tr('mobile.reminders.denied')}
      </Alert>
    );
  }
  return null;
}
