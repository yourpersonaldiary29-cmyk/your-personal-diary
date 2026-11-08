/**
 * "This needs a connection to the diary server. [Try again]" (docs/android-tasks/OFFLINE-DESIGN.md
 * section 6.2): what the online-only pages show while offline mode runs without a connection - insights,
 * stats, search, backup / restore / export - and the description of the buttons that are disabled then
 * (account management, habit delete and reorder, demo data).
 *
 * Renders nothing unless offline mode runs AND the server cannot be reached (`useOfflineNow`): local
 * builds, old servers, guests and the page tests see exactly today's pages.
 */
import { useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PageTitle } from '@/components/ui/PageTitle';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { offline } from '@/offline';
import { tr } from '@/i18n/runtime';
import { useOfflineNow } from './hooks';
import './sync.css';

export { useOfflineNow as useNeedsConnection } from './hooks';

export interface NeedsConnectionProps {
  /** Shown above the notice (the page's own title, so the page keeps its heading). */
  children?: ReactNode;
  /** Render even while online (tests, a caller that decided itself). */
  force?: boolean;
}

/** The notice with "Try again" (a probe; when the server answers, the notice goes by itself). */
export function NeedsConnection({ children, force }: NeedsConnectionProps) {
  const offlineNow = useOfflineNow();
  const { announce } = useAnnouncer();
  const [trying, setTrying] = useState(false);
  if (!offlineNow && !force) return null;

  const onTry = async () => {
    if (trying) return;
    setTrying(true);
    try {
      const ok = await offline.tryNow();
      announce(tr(ok ? 'shell.connection.restored' : 'shell.connection.failed'), ok ? 'polite' : 'assertive');
    } finally {
      setTrying(false);
    }
  };

  return (
    <>
      {children}
      <Alert kind="info" data-testid="needs-connection">
        <div className="needs-connection">
          <p className="needs-connection__text">{tr('shell.sync.needsConnection')}</p>
          <Button variant="secondary" size="sm" loading={trying} onClick={() => void onTry()}>
            {tr('shell.retry')}
          </Button>
        </div>
      </Alert>
    </>
  );
}

/** A whole online-only page while offline: its title, then the notice. */
export function NeedsConnectionPage({ title }: { title: string }) {
  return (
    <div className="stack">
      <NeedsConnection force>
        <PageTitle title={title} />
      </NeedsConnection>
    </div>
  );
}

/** The description of a button disabled while offline (point the button's `aria-describedby` at `id`). */
export function NeedsConnectionHint({ id }: { id: string }) {
  const offlineNow = useOfflineNow();
  if (!offlineNow) return null;
  return (
    <p id={id} className="needs-connection-hint">
      {tr('shell.sync.needsConnection')}
    </p>
  );
}
