/**
 * "No connection to the diary server" - the full-page state of the apps when the server cannot be
 * reached before anything of the user's is on screen (start-up, the session check), with one action:
 * Retry (src/context/ConnectionContext.tsx decides when it is shown). The server is named plainly -
 * "the diary server" - never as an address to copy; the texts exist in all 20 languages.
 *
 * Retry probes the server; while it runs the button shows its spinner. The result is said under the
 * button (a status line, announced): "Still no connection..." or, when the server answered, the page
 * is replaced by the app (the store flips, the router renders the routes) and "...is back" is announced.
 */
import { useEffect, useRef, useState } from 'react';
import { FocusHeading } from '@/components/a11y/FocusHeading';
import { DeviceWaitingNotice } from '@/components/sync/WaitingNotices';
import { Button } from '@/components/ui/Button';
import { PAGE_TITLE_ID } from '@/components/ui/PageTitle';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { retryConnection, useConnection } from '@/context/ConnectionContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/runtime';
import './no-connection.css';

export default function NoConnectionPage() {
  const { retrying } = useConnection();
  const { announce } = useAnnouncer();
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  useDocumentTitle(tr('shell.connection.title'));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onRetry = async () => {
    if (retrying) return;
    setFailed(false);
    const ok = await retryConnection();
    if (ok) {
      announce(tr('shell.connection.restored'), 'polite');
      return;
    }
    if (!mounted.current) return;
    setFailed(true);
    announce(tr('shell.connection.failed'), 'assertive');
  };

  return (
    <section className="no-connection" data-testid="no-connection-page">
      <div className="no-connection__icon" aria-hidden="true">
        ⚠
      </div>
      <FocusHeading id={PAGE_TITLE_ID} focus="always" className="no-connection__title">
        {tr('shell.connection.title')}
      </FocusHeading>
      <p className="no-connection__text">{tr('shell.connection.text')}</p>
      {/* Offline mode: changes of some account wait on this device (no account is named). */}
      <DeviceWaitingNotice />
      <div className="no-connection__actions">
        <Button size="lg" loading={retrying} onClick={() => void onRetry()}>
          {retrying ? tr('shell.connection.retrying') : tr('shell.retry')}
        </Button>
      </div>
      <p className="no-connection__status" role="status">
        {failed && !retrying ? tr('shell.connection.failed') : ''}
      </p>
    </section>
  );
}
