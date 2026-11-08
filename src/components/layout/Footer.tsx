/**
 * Footer: the one-line privacy reassurance, a button that opens the
 * keyboard-shortcuts dialog and the app version. With the Your Personal Diary
 * server the reassurance names the server and never says "end to end".
 */
import { VisuallyHidden } from '@/components/a11y/VisuallyHidden';
import { T } from '@/constants/texts';
import { useHostedServer } from '@/context/ConnectionContext';
import { APP_VERSION } from '@shared/constants';

export interface FooterProps {
  /** Opens the "Keyboard shortcuts" dialog. */
  onShowShortcuts?: () => void;
}

export function Footer({ onShowShortcuts }: FooterProps) {
  const hosted = useHostedServer();
  return (
    <footer className="footer">
      <div className="footer__inner">
        <p>{T.footerPrivacyFor(hosted)}</p>
        <div className="cluster">
          {onShowShortcuts && (
            <button type="button" className="btn-link" onClick={onShowShortcuts}>
              {T.shortcuts}
            </button>
          )}
          <span className="text-small">
            <span aria-hidden="true">v{APP_VERSION}</span>
            <VisuallyHidden>{T.version(APP_VERSION)}</VisuallyHidden>
          </span>
        </div>
      </div>
    </footer>
  );
}
