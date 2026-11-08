/**
 * "Skip - just look around": the secondary button of the welcome, login and registration screens.
 * It starts the tour mode - POST /api/auth/guest through `startGuest` of the AuthContext (device
 * name + the current UI language; the session is stored like a login WITHOUT "Remember me") - and
 * enters the app with the sample data.
 *
 * Offered in the Android app only (`tourOffered`; owner decision 2026-10-23,
 * docs/android-tasks/HOSTED-IMPL.md item 12): the phone UI of the mobile build. The Windows app and the
 * web UI served by the diary server never show it, even though that server mounts the route and says
 * `ServerInfo.guestTour: true` (it keeps it for the Android app). In the Android app the button is
 * there before the server described itself, when the hosted server says `guestTour: true`, and with
 * the phone's own in-process core (which always has the route). A 404 answer still means "no tour
 * here": the button disappears for the rest of this run of the app (on all three screens) with a short
 * notice. Any other failure is shown under the button and the button stays. Its styles are the
 * phone's (src/styles/mobile.css, under .platform-mobile).
 */
import { useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ServerInfo } from '@shared/types';
import { isApiClientError } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PAGE_TITLE_ID } from '@/components/ui/PageTitle';
import { PATHS } from '@/constants/routes';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';
import { useServerInfo } from '@/context/ConnectionContext';
import { useToast } from '@/context/ToastContext';
import { tr } from '@/i18n/runtime';
import { errorMessage } from '@/utils/errors';
import { isMobileUi } from '@/utils/mobile-ui';

/**
 * Whether the tour is offered: never outside the Android app (`phoneUi` false: the Windows app, the
 * web UI), whatever the server says. In the Android app: while the server has not described itself
 * (yet), when the hosted server says `guestTour: true`, and with a server that is not the hosted one
 * (the phone's own core mounts the route); a hosted server that says `guestTour: false` (the tour
 * turned off) hides it.
 */
export function tourOffered(info: ServerInfo | null, phoneUi: boolean = isMobileUi()): boolean {
  if (!phoneUi) return false;
  if (!info) return true;
  return info.guestTour === true || info.mode !== 'hosted';
}

/** The server answered 404 to the guest route during this run: the button is not offered again. */
let guestModeMissing = false;

/** Tests only: forgets a 404 answer of an earlier test. */
export function __resetSkipTourForTests(): void {
  guestModeMissing = false;
}

export function SkipTourButton() {
  const { startGuest } = useAuth();
  const toast = useToast();
  const { announce } = useAnnouncer();
  const navigate = useNavigate();
  const location = useLocation();
  const hintId = useId();
  const info = useServerInfo();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(guestModeMissing);
  const [error, setError] = useState<string | null>(null);

  if (!tourOffered(info) || !startGuest || hidden) return null;

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await startGuest();
      toast.info(tr('mobile.guest.started'));
      if (location.pathname !== PATHS.home) navigate(PATHS.home, { replace: true });
    } catch (e) {
      if (isApiClientError(e) && e.status === 404) {
        // No guest mode on this server: take the button away and say why.
        guestModeMissing = true;
        setHidden(true);
        toast.info(tr('mobile.guest.unavailable'));
        // The button that had the focus is gone: continue at the page heading.
        document.getElementById(PAGE_TITLE_ID)?.focus();
        return;
      }
      const message = errorMessage(e);
      setError(message);
      announce(message, 'assertive');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="skip-tour">
      <Button variant="secondary" loading={busy} aria-describedby={hintId} onClick={() => void onClick()}>
        {tr('mobile.guest.skip')}
      </Button>
      <p id={hintId} className="skip-tour__hint">
        {tr('mobile.guest.skipHint')}
      </p>
      {error && (
        <Alert kind="error" role="none">
          {error}
        </Alert>
      )}
    </div>
  );
}
