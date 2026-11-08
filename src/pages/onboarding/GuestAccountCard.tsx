/**
 * "Tour mode" card of the settings page - what the guest of the tour mode (phone app) sees in place
 * of the account card: why the account, security and backup settings are missing, and the two ways
 * out - "Create an account" (ends the guest and opens the registration page, no toast) and "End the
 * tour" (back to the welcome screen with the toast "The tour has ended").
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PATHS } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';
import { tr } from '@/i18n/runtime';

export function GuestAccountCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | 'register' | 'end'>(null);

  const end = async (then: 'register' | 'end') => {
    if (busy) return;
    setBusy(then);
    try {
      // logout() drops the guest (session and in-memory diary) and leaves the app on the welcome page.
      await logout({ notice: then === 'register' ? 'none' : 'auto' });
      if (then === 'register') navigate(PATHS.register, { replace: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title={tr('mobile.guest.settingsTitle')}>
      <div className="stack-sm">
        <p>{tr('mobile.guest.settingsText')}</p>
        <div className="cluster">
          <Button loading={busy === 'register'} onClick={() => void end('register')}>
            {tr('mobile.guest.createAccount')}
          </Button>
          <Button variant="secondary" loading={busy === 'end'} onClick={() => void end('end')}>
            {tr('mobile.guest.endTour')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
