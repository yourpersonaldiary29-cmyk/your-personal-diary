/**
 * Page frame shared by every route: skip link, header, navigation, the
 * <main> landmark (focus target of the skip link) and the footer.
 * The wrapper has id "app-root" so the lock screen can mark it `inert`.
 *
 * In the Android build the frame is the phone shell instead (MobileShell: top app bar, bottom
 * navigation, floating "New entry" button, "More" sheet). `__MOBILE__` is a build-time constant -
 * false in the desktop / browser build, so that branch and the phone shell behind it are not part of
 * the desktop bundle at all. No platform has a first-run language screen
 * (docs/android-tasks/HOSTED-IMPL.md item 13).
 */
import type { ReactNode } from 'react';
import { SkipLink } from '@/components/a11y/SkipLink';
import { Footer } from './Footer';
import { Header } from './Header';
import { MobileShell } from './MobileShell';
import { NavBar } from './NavBar';
import { APP_ROOT_ID, MAIN_ID } from './shell-ids';

export { APP_ROOT_ID, MAIN_ID };

export interface AppShellProps {
  children: ReactNode;
  /** Opens the keyboard-shortcuts dialog (footer button; in the phone shell an entry of the "More" sheet). */
  onShowShortcuts?: () => void;
}

export function AppShell({ children, onShowShortcuts }: AppShellProps) {
  if (typeof __MOBILE__ !== 'undefined' && __MOBILE__) {
    return <MobileShell onShowShortcuts={onShowShortcuts}>{children}</MobileShell>;
  }
  return <DesktopShell onShowShortcuts={onShowShortcuts}>{children}</DesktopShell>;
}

function DesktopShell({ children, onShowShortcuts }: AppShellProps) {
  return (
    <div id={APP_ROOT_ID} className="app-root">
      <SkipLink targetId={MAIN_ID} />
      <Header />
      <NavBar />
      <main id={MAIN_ID} tabIndex={-1} className="main">
        {children}
      </main>
      <Footer onShowShortcuts={onShowShortcuts} />
    </div>
  );
}
