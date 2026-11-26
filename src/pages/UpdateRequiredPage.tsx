/**
 * "Update needed" (app version 1.1.0): the ONE screen an app shows while the owner's required-update rule
 * says its version may no longer be used (src/utils/appUpdate.ts decides, src/hooks/useUpdateGate.ts says
 * when). src/App.tsx renders it IN PLACE of everything else - the pages, the frame (menus, bars, the skip
 * link) and the lock screen. It hides the app; it ends nothing: the session and the offline engine go on
 * underneath (queued changes keep uploading, nothing on the device is deleted), so whoever updates is in
 * again without signing in.
 *
 * What it shows: the app's name, one h1 (it takes the focus when the screen appears), the installed
 * version inside the first sentence, the sentence that the diary is safe, and the button of the platform:
 *  - Android: "Open Google Play" when the server gave the store link - and under it the sentence "If you
 *    installed the app from the site and not from Google Play, update it from the Downloads page." with a second,
 *    quieter link "Open the Downloads page" (the site's page in the app's language; an install from the site's
 *    file cannot be updated from Google Play - src/utils/appUpdate.ts `otherUpdateTarget`); without the store
 *    link only "Open the Downloads page", no sentence;
 *  - iPhone: "Open the App Store" when the server gave the link, else only "Update the app in the App Store.";
 *  - Windows and Mac: "Open the Downloads page" (the site's page in the app's language).
 * The phone apps open the address by an ordinary link (the WebView hands an address of another origin to
 * the system: the store app or the browser) - the second link of Android as well. The Windows and Mac shells open it through `open_external_url`
 * (src-tauri/src/opener.rs: the Downloads pages are on its list, no store host is); when that fails the
 * address is shown as text to open by hand ("shell.legal.openInBrowser").
 *
 * "Check again" asks the server again (the probe of src/context/ConnectionContext.tsx): when the rule no
 * longer applies the screen goes away by itself; when it still does, "This version still needs an update."
 * is said under the button and announced once, politely; when the server cannot be reached, "Still no
 * connection to the diary server." (the same way).
 *
 * In the phone apps the screen keeps the phone setup of the document (the phone stylesheet and the class
 * 'platform-mobile' on <html>: src/App.tsx holds it for the whole app, src/components/layout/useMobileDocument.ts),
 * and the system Back button answers 'exit' while it is shown (it registers as a blocking screen with
 * src/utils/back-handler.ts): a dialog above it is closed first, nothing behind it moves.
 *
 * Styles: src/pages/update-required.css (theme tokens: light, dark and forced colours; logical properties
 * for right-to-left; the buttons are at least 44 px high, 48 px on the phone).
 */
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { FocusHeading } from '@/components/a11y/FocusHeading';
import { openInSystemBrowser } from '@/components/legal/LegalPageLink';
import { Button } from '@/components/ui/Button';
import { PAGE_TITLE_ID } from '@/components/ui/PageTitle';
import { getServerInfo } from '@/api';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { retryConnection, useConnection } from '@/context/ConnectionContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getCurrentLocale, tr } from '@/i18n/runtime';
import { registerBlockingScreen } from '@/utils/back-handler';
import { isMobileUi } from '@/utils/mobile-ui';
import { otherUpdateTarget, updateRequirement, updateTarget, type UpdateRequirement, type UpdateTarget } from '@/utils/appUpdate';
import { isTauri } from '@/utils/platform';
import './update-required.css';

export const UPDATE_REQUIRED_TEST_ID = 'update-required-page';

/** The sentence "If you installed the app from the site ..." - the description of the second link. */
const OTHER_TEXT_ID = 'update-required-from-site';

/** The visible text of the button for a target that has one. */
function targetLabel(target: Exclude<UpdateTarget, { kind: 'none' }>): string {
  switch (target.kind) {
    case 'googlePlay':
      return tr('shell.update.openGooglePlay');
    case 'appStore':
      return tr('shell.update.openAppStore');
    default:
      return tr('shell.update.openDownloads');
  }
}

/** What the line under "Check again" says after a check. */
type CheckResult = 'still' | 'noConnection' | null;

export interface UpdateRequiredPageProps {
  requirement: UpdateRequirement;
}

export default function UpdateRequiredPage({ requirement }: UpdateRequiredPageProps) {
  const { retrying } = useConnection();
  const { announce } = useAnnouncer();
  const [result, setResult] = useState<CheckResult>(null);
  const [showAddress, setShowAddress] = useState(false);
  const mounted = useRef(true);
  const title = tr('shell.update.title');
  useDocumentTitle(title);

  // Phone UI: the system Back button leaves the app while the screen is shown - the hidden pages do not move.
  // Registered before the first paint and unregistered when the screen goes.
  useLayoutEffect(() => (isMobileUi() ? registerBlockingScreen() : undefined), []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const target = updateTarget(requirement, getCurrentLocale());
  // Android with a store link only: the Downloads page as the other way (an install from the site's file
  // cannot be updated from Google Play, and the app cannot tell where it was installed from).
  const other = otherUpdateTarget(requirement, getCurrentLocale());

  const onOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    // The phone apps open the link themselves (the WebView hands it to the system); only the desktop shell needs the command.
    if (!isTauri() || target.kind === 'none') return;
    event.preventDefault();
    const url = target.url;
    void openInSystemBrowser(url).then((opened) => {
      if (!opened && mounted.current) setShowAddress(true);
    });
  };

  const onCheck = async () => {
    if (retrying) return;
    setResult(null);
    const reached = await retryConnection();
    if (!mounted.current) return;
    if (!reached) {
      setResult('noConnection');
      announce(tr('shell.connection.failed'), 'polite');
      return;
    }
    // The rule no longer applies: App takes this screen away with the same store update - nothing to say here.
    if (!updateRequirement(requirement.platform, requirement.installed, getServerInfo())) return;
    setResult('still');
    announce(tr('shell.update.stillRequired'), 'polite');
  };

  const status = retrying ? '' : result === 'still' ? tr('shell.update.stillRequired') : result === 'noConnection' ? tr('shell.connection.failed') : '';

  return (
    <main className="update-required" data-testid={UPDATE_REQUIRED_TEST_ID} data-platform={requirement.platform}>
      <p className="update-required__app" translate="no">
        {tr('shell.appName')}
      </p>
      <FocusHeading id={PAGE_TITLE_ID} focus="always" className="update-required__title">
        {title}
      </FocusHeading>
      <p className="update-required__text">
        {tr('shell.update.body', { version: requirement.installed })}
      </p>
      <p className="update-required__text">{tr('shell.update.safe')}</p>
      <div className="update-required__actions">
        {target.kind === 'none' ? (
          <p className="update-required__store-hint" data-testid="update-required-store-hint">
            {tr('shell.update.iphoneNoLink')}
          </p>
        ) : (
          <a
            className="btn btn--primary btn--lg update-required__open"
            href={target.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpen}
            data-testid="update-required-open"
          >
            {targetLabel(target)}
          </a>
        )}
        {other && (
          <div className="update-required__other">
            <p className="update-required__other-text" id={OTHER_TEXT_ID} data-testid="update-required-from-site">
              {tr('shell.update.fromSite')}
            </p>
            <a
              className="btn btn--secondary btn--lg update-required__open-other"
              href={other.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-describedby={OTHER_TEXT_ID}
              data-testid="update-required-open-other"
            >
              {tr('shell.update.openDownloads')}
            </a>
          </div>
        )}
        <Button variant="secondary" size="lg" loading={retrying} onClick={() => void onCheck()} data-testid="update-required-retry">
          {tr('shell.update.retry')}
        </Button>
      </div>
      {showAddress && target.kind !== 'none' && (
        <p className="update-required__address" role="status" data-testid="update-required-address">
          {tr('shell.legal.openInBrowser', { url: target.url })}
        </p>
      )}
      {/* Shown here and said ONCE, politely, through the announcer - not a live region of its own as well. */}
      <p className="update-required__status" data-testid="update-required-status">
        {status}
      </p>
    </main>
  );
}
