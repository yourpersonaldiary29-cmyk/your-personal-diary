/**
 * Settings page ("/settings"). Public route: anonymous visitors get the
 * language and display preferences and links to log in / register; a signed-in
 * user gets language, account, display, privacy, remote access and e-mail for
 * password reset (both on the computer itself only, and only for the owner of
 * this computer's diary - the account created first on it), security,
 * reminders, data (demo data while the diary is empty), (desktop only)
 * diagnostics and, as the very last card, "Delete account". The
 * language card comes first so it is reachable in any language the user may be
 * stuck in.
 *
 * Phone app: "Remote access" does not exist there (no DuckDNS / HTTPS listener on a phone), so its
 * card is never rendered. The guest of the tour mode gets a "Tour mode" card instead of the account
 * card, and none of the cards a guest cannot use: account and password, e-mail for password reset,
 * security (the lock - a guest has no password to unlock with) and "Delete account". Backup and
 * restore live on their own page, which the phone shell does not offer to a guest.
 *
 * Your Personal Diary server (the published Windows and Android apps, the web UI it serves -
 * `useHostedServer`): what a hosted server does not offer is not shown - no Diagnostics card (no
 * local server to inspect or restart), no phone access on the home network (PrivacySection), and
 * the remote-access card hides itself through the server flags (`isRemoteOwner` is always false
 * there); the e-mail card stays for the configured owner, and the "Server" card (status, encrypted server
 * archive - settings/ServerSection) is shown to that owner only. The Privacy card says where the diary is.
 */
import { LinkButton } from '@/components/ui/LinkButton';
import { Card } from '@/components/ui/Card';
import { PageTitle } from '@/components/ui/PageTitle';
import { Spinner } from '@/components/ui/Spinner';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { isGuestUser, useAuth } from '@/context/AuthContext';
import { useHostedServer } from '@/context/ConnectionContext';
import { isTauri } from '@/utils/platform';
import { GuestAccountCard } from './onboarding/GuestAccountCard';
import { AccountSection } from './settings/AccountSection';
import { DataSection } from './settings/DataSection';
import { DeleteAccountSection } from './settings/DeleteAccountSection';
import { PrivacySection } from './settings/PrivacySection';
import { RemoteAccessSection } from './settings/RemoteAccessSection';
import { DiagnosticsSection } from './settings/DiagnosticsSection';
import { DisplaySection } from './settings/DisplaySection';
import { LanguageSection } from './settings/LanguageSection';
import { MailSection } from './settings/MailSection';
import { RemindersSection } from './settings/RemindersSection';
import { SecuritySection } from './settings/SecuritySection';
import { ServerSection } from './settings/ServerSection';
import { ST } from './settings/texts';
import './settings/settings.css';

function AnonymousAccountCard() {
  return (
    <Card title={ST.account}>
      <div className="stack-sm">
        <p>{ST.anonymousAccountText}</p>
        <div className="cluster">
          <LinkButton to={PATHS.login}>{T.login}</LinkButton>
          <LinkButton to={PATHS.register} variant="secondary">
            {T.register}
          </LinkButton>
        </div>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { status, user } = useAuth();
  const desktop = isTauri();
  const hosted = useHostedServer();
  // `__MOBILE__` is a build-time constant (false on the desktop): there it is plain `false`.
  const phone = typeof __MOBILE__ !== 'undefined' && __MOBILE__;
  // The guest of the tour mode: started only in the Android app, on the phone's own core or the hosted server (nowhere else can a guest exist).
  const guest = isGuestUser(user);

  return (
    <div className="settings-page stack">
      <PageTitle title={ST.settingsTitle} />
      <LanguageSection />
      {status === 'loading' && <Spinner label={T.loadingSession} block size="lg" />}
      {status === 'authenticated' && !guest && <AccountSection />}
      {status === 'authenticated' && guest && <GuestAccountCard />}
      {status === 'anonymous' && <AnonymousAccountCard />}
      <DisplaySection />
      {status === 'authenticated' && (
        <>
          <PrivacySection />
          {/* Show themselves only on the computer (server.info().isLocalRequest), and only to
              the owner (ServerSettings.isRemoteOwner / isMailOwner, see settings/useOwnerCard). */}
          {!phone && !guest && <RemoteAccessSection />}
          {!guest && <MailSection />}
          {/* The hosted server's owner only (ServerSettings.isServerOwner): status and the encrypted server archive. */}
          {!guest && hosted && <ServerSection />}
          {!guest && <SecuritySection />}
          <RemindersSection />
          <DataSection />
          {/* The local server's diagnostics: the desktop's local-mode configuration only, never the hosted server. */}
          {desktop && !hosted && <DiagnosticsSection />}
          {/* Always the very last card: the only way to delete the account. */}
          {!guest && <DeleteAccountSection />}
        </>
      )}
    </div>
  );
}
