/**
 * "Phone access on the home network" section of the data card (desktop only):
 * the LAN listener switch, the addresses to open on the phone with copy
 * buttons, and the connection instructions. It loads the server info and the
 * server settings itself and saves the switch through PUT /api/server/settings
 * (the addresses are re-read afterwards).
 *
 * Phone access is the owner's decision (the first account created on this
 * computer, `isLanOwner`): other accounts see its state, not the switch.
 * Turning it on opens the diary's sign-in page to the home network, so it asks
 * for the account password first (a dialog); turning it off does not.
 */
import { useId, useState } from 'react';
import { server as serverApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Spinner';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useApi } from '@/hooks/useApi';
import { errorField, errorMessage } from '@/utils/errors';
import { copyText } from './clipboard';
import { ST } from './texts';

export const LAN_ACCESS_CHECKBOX_ID = 'settings-lan-access';

export function LanAccessSection() {
  const { announce } = useAnnouncer();
  const headingId = useId();
  const urlsHeadingId = useId();
  const stepsHeadingId = useId();
  const info = useApi(() => serverApi.info(), []);
  const serverSettings = useApi(() => serverApi.getSettings(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const isLocal = info.data?.isLocalRequest === true;
  // Older servers do not report it: then the switch is shown and the server decides.
  const isOwner = serverSettings.data?.isLanOwner !== false;
  const lanEnabled = serverSettings.data?.lanEnabled ?? info.data?.lanEnabled ?? false;
  const urls = info.data?.lanUrls ?? [];
  const loading = (info.loading && !info.data) || (serverSettings.loading && !serverSettings.data);
  const loadError = info.error ?? serverSettings.error;

  const save = async (enabled: boolean, password?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setConfirmError(null);
    try {
      const saved = await serverApi.updateSettings(password === undefined ? { lanEnabled: enabled } : { lanEnabled: enabled, password });
      serverSettings.setData(saved);
      setConfirmOpen(false);
      await info.reload();
      announce(saved.lanEnabled ? ST.lanEnabledMsg : ST.lanDisabledMsg, 'polite');
    } catch (e) {
      const message = errorMessage(e);
      // A missing / wrong password stays in the dialog (it announces it there).
      if (confirmOpen && errorField(e) === 'password') {
        setConfirmError(message);
      } else {
        setConfirmOpen(false);
        setError(message);
        announce(message, 'assertive');
      }
    } finally {
      setBusy(false);
    }
  };

  const onChange = (enabled: boolean) => {
    if (enabled) {
      // Opening the diary to the home network: confirm with the account password first.
      setConfirmError(null);
      setConfirmOpen(true);
      return;
    }
    void save(false);
  };

  const copy = async (url: string) => {
    const ok = await copyText(url);
    announce(ok ? ST.copied(url) : ST.copyFailed, ok ? 'polite' : 'assertive');
  };

  return (
    <section aria-labelledby={headingId} className="stack-sm">
      <h3 id={headingId}>{ST.lanAccess}</h3>
      {loading && <Spinner />}
      {loadError && <Alert kind="error">{loadError}</Alert>}
      {error && <Alert kind="error" role="none">{error}</Alert>}
      {info.data && !isLocal && <p>{ST.lanOnlyFromComputer}</p>}
      {info.data && isLocal && isOwner && (
        <Checkbox
          id={LAN_ACCESS_CHECKBOX_ID}
          label={ST.lanAccessLabel}
          hint={ST.lanAccessHint}
          checked={lanEnabled}
          onChange={(checked) => onChange(checked)}
        />
      )}
      {info.data && isLocal && !isOwner && (
        <>
          <p>{lanEnabled ? ST.lanStatusOn : ST.lanStatusOff}</p>
          <p className="text-muted text-small">{ST.lanOwnerOnly}</p>
        </>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={ST.lanConfirmTitle}
        message={ST.lanConfirmMessage}
        requirePassword
        loading={busy}
        error={confirmError}
        onConfirm={(password) => save(true, password ?? '')}
        onCancel={() => {
          if (busy) return;
          setConfirmOpen(false);
          setConfirmError(null);
        }}
      />
      {info.data && lanEnabled && (
        <div className="stack-sm">
          <section aria-labelledby={urlsHeadingId}>
            <h4 id={urlsHeadingId}>{ST.lanUrlsTitle}</h4>
            {urls.length === 0 ? (
              <p>{ST.lanNoUrls}</p>
            ) : (
              <ul className="lan-urls">
                {urls.map((url) => (
                  <li className="lan-urls__item" key={url}>
                    <code className="lan-urls__url">{url}</code>
                    <Button variant="secondary" size="sm" aria-label={ST.copyName(url)} onClick={() => void copy(url)}>
                      {ST.copy}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby={stepsHeadingId}>
            <h4 id={stepsHeadingId}>{ST.lanInstructionsTitle}</h4>
            <ol>
              {ST.lanInstructions.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </section>
  );
}
