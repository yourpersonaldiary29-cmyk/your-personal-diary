/**
 * "Privacy" card - replaces the former Privacy page (owner decision 2026-09-28).
 * It keeps only what the user can switch on or off, under one reassurance sentence:
 *   - Offline privacy mode (the app may not open network connections other than
 *     to its own local server; enforced by the network guard in src/api/client.ts);
 *   - Phone access on the home network (desktop only; LanAccessSection).
 * Encryption itself is not a setting: the diary is always encrypted.
 *
 * Remote access (the next card, RemoteAccessSection) needs outbound connections,
 * so turning offline privacy mode on while remote access is on first asks for
 * confirmation - with the account password, which every change of remote access
 * needs - and then turns remote access off. Only the account that set remote
 * access up ever sees that question: for other accounts the Remote access card
 * publishes no status, and their offline mode does not touch remote access.
 *
 * Your Personal Diary server (`useHostedServer`): the reassurance says where the
 * diary is - "stored on the Your Personal Diary server and encrypted with your
 * password" - with the server's address as read-only text (never an input), the
 * offline switch's hint names the diary server instead of "its own local server",
 * and phone access on the home network is not offered (there is no home network).
 *
 * The card also links to the privacy policy of the apps and the website and, under it, to the Terms of Use
 * (LegalPageLink: the pages on the diary server, in the UI language, opened outside the app -
 * docs/play-tasks/PLAY-LEGAL.md item 4, docs/apple-tasks/TERMS.md).
 */
import { useState } from 'react';
import { server as serverApi, setOfflinePrivacyMode } from '@/api';
import { LegalPageLink, PrivacyPolicyLink } from '@/components/legal/PrivacyPolicyLink';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useHostedServer, useServerHost } from '@/context/ConnectionContext';
import { useSettings } from '@/context/SettingsContext';
import { errorCode, errorMessage } from '@/utils/errors';
import { isTauri } from '@/utils/platform';
import { LanAccessSection } from './LanAccessSection';
import { publishRemoteStatus, useRemoteStatus } from './remoteAccessStore';
import { RT } from './remoteTexts';
import { ST } from './texts';
import { useSettingsSaver } from './useSettingsSaver';

export const OFFLINE_MODE_CHECKBOX_ID = 'settings-offline-mode';

export function PrivacySection() {
  const { settings } = useSettings();
  const { save, error } = useSettingsSaver();
  const desktop = isTauri();
  const hosted = useHostedServer();
  const serverHost = useServerHost();
  const remote = useRemoteStatus();
  const [confirmOffline, setConfirmOffline] = useState(false);
  const [turningRemoteOff, setTurningRemoteOff] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const applyOffline = async (checked: boolean, message: string) => {
    // Apply the guard immediately; the saved setting keeps it after restarts.
    setOfflinePrivacyMode(checked);
    const ok = await save({ offlinePrivacyMode: checked }, message);
    if (!ok) setOfflinePrivacyMode(!checked);
  };

  const onOfflineToggle = async (checked: boolean) => {
    if (checked && remote?.enabled) {
      setRemoteError(null);
      setConfirmOffline(true);
      return;
    }
    await applyOffline(checked, checked ? ST.offlineOn : ST.offlineOff);
  };

  /** Confirmed with the account password: turn remote access off, then offline privacy mode on. */
  const onConfirmOffline = async (password?: string) => {
    if (turningRemoteOff) return;
    if (!password) {
      setRemoteError(RT.passwordMissing);
      return;
    }
    setTurningRemoteOff(true);
    setRemoteError(null);
    try {
      publishRemoteStatus(await serverApi.remote.put({ enabled: false, password }));
    } catch (e) {
      setRemoteError(errorCode(e) === 'WRONG_PASSWORD' ? RT.wrongPassword : errorMessage(e));
      setTurningRemoteOff(false);
      return;
    }
    setTurningRemoteOff(false);
    setConfirmOffline(false);
    await applyOffline(true, `${ST.offlineOn} ${RT.disabledByOffline}`);
  };

  return (
    <Card title={ST.privacy}>
      <div className="stack">
        <p className="settings-reassurance">{hosted ? ST.hostedReassurance : ST.dataReassurance}</p>
        {hosted && serverHost && (
          // Read-only: the apps are wired to this server and nothing here changes it.
          <p className="text-muted text-small" data-testid="server-address">
            {ST.serverAddress(serverHost)}
          </p>
        )}
        {/* The one privacy policy of the apps and the website, on the diary server (opens outside the app). */}
        <p className="text-small">
          <PrivacyPolicyLink>{ST.privacyPolicyLink}</PrivacyPolicyLink>
        </p>
        {/* The Terms of Use of the apps and the website, on the same server (opens outside the app). */}
        <p className="text-small">
          <LegalPageLink page="terms">{ST.termsLink}</LegalPageLink>
        </p>
        {error && <Alert kind="error">{error}</Alert>}
        <Checkbox
          id={OFFLINE_MODE_CHECKBOX_ID}
          label={ST.offlineLabel}
          hint={hosted ? ST.offlineHintServer : ST.offlineHint}
          checked={settings.offlinePrivacyMode}
          onChange={(checked) => void onOfflineToggle(checked)}
        />
        {desktop && !hosted && <LanAccessSection />}
      </div>
      <ConfirmDialog
        open={confirmOffline}
        title={RT.offlineConflictTitle}
        message={
          <>
            <p>{RT.offlineConflictMessage}</p>
            <p>{RT.offlineConflictPassword}</p>
          </>
        }
        confirmLabel={RT.offlineConflictConfirm}
        requirePassword
        onConfirm={onConfirmOffline}
        onCancel={() => setConfirmOffline(false)}
        loading={turningRemoteOff}
        error={remoteError}
      />
    </Card>
  );
}
