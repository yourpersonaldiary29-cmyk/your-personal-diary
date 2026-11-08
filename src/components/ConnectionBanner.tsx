/**
 * "No connection to the diary server. [Try again]" - the banner over the running app when a request
 * failed to reach the server after it had worked in this run (src/context/ConnectionContext.tsx,
 * `useConnectionDisplay() === 'banner'`). It never replaces the page: what the user is doing - a
 * half-written entry - stays on screen. Retry probes the server; when it answers the banner goes
 * (the store flips) and the pages' own "Try again" buttons reload their data. Renders nothing while
 * the connection is fine or while the full-page state is shown instead.
 */
import { useSyncEnabled } from '@/components/sync/hooks';
import { Button } from '@/components/ui/Button';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { retryConnection, useConnection, useConnectionDisplay } from '@/context/ConnectionContext';
import { tr } from '@/i18n/runtime';
import '@/pages/no-connection.css';

export function ConnectionBanner() {
  const display = useConnectionDisplay();
  const { retrying } = useConnection();
  const { announce } = useAnnouncer();
  // While the automatic offline mode runs for the signed-in account, its status bar takes this slot
  // (src/components/sync/SyncStatusBar.tsx, OFFLINE-DESIGN.md section 6.1).
  const syncEnabled = useSyncEnabled();
  if (display !== 'banner' || syncEnabled) return null;

  const onRetry = async () => {
    if (retrying) return;
    const ok = await retryConnection();
    announce(tr(ok ? 'shell.connection.restored' : 'shell.connection.failed'), ok ? 'polite' : 'assertive');
  };

  return (
    <div className="connection-banner" data-testid="connection-banner">
      <p className="connection-banner__text" role="status">
        {tr('shell.connection.noServer')}
      </p>
      <Button variant="secondary" size="sm" loading={retrying} className="connection-banner__action" onClick={() => void onRetry()}>
        {retrying ? tr('shell.connection.retrying') : tr('shell.retry')}
      </Button>
    </div>
  );
}
