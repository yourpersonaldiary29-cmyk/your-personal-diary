/**
 * "Connected devices" list: every session of the account (desktop, phone, browser)
 * with its creation time and last activity. The current session is marked
 * with a badge and cannot be revoked from here (use "Log out" instead).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { LOCALE_CODES, t } from '@shared/i18n';
import type { SessionInfo } from '@shared/types';
import { auth as authApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { NeedsConnectionHint } from '@/components/sync/NeedsConnection';
import { useOfflineNow } from '@/components/sync/hooks';
import { drainBeforeOnlineWrite } from '@/components/sync/syncGate';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useApi } from '@/hooks/useApi';
import { tr } from '@/i18n/runtime';
import { formatTimestamp } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { ST } from './texts';

/**
 * The device names the app generates itself ("Computer" / "Phone" / "Browser" from the UI, "Device"
 * from the server). They are stored in the language of the moment the session was created.
 */
const GENERATED_DEVICE_KEYS = ['shell.device.computer', 'shell.device.phone', 'shell.device.browser', 'server.auth.defaultDeviceName'];

/**
 * Display name of a session's device (never empty). A generated name is shown in the current
 * language, whichever language it was saved in (an English "Browser" in a Hebrew list otherwise).
 */
export function deviceLabel(session: SessionInfo): string {
  const name = session.deviceName?.trim();
  if (!name) return ST.unknownDevice;
  const key = GENERATED_DEVICE_KEYS.find((k) => LOCALE_CODES.some((code) => t(code, k) === name));
  return key ? tr(key) : name;
}

export function SessionsList() {
  const headingId = useId();
  const { announce } = useAnnouncer();
  const { data, loading, error, setData } = useApi(() => authApi.sessions(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const sessions = Array.isArray(data) ? data : null;
  const revokeId = (sessionId: string) => `${headingId}-revoke-${sessionId}`;
  /**
   * Where focus goes after a device left the list (its button, which had the focus, is gone):
   * the "Disconnect" button of the next device (or the previous one), else the list heading.
   * null = nothing to do.
   */
  const focusAfterRevoke = useRef<string | null>(null);

  useEffect(() => {
    const target = focusAfterRevoke.current;
    if (target === null) return;
    focusAfterRevoke.current = null;
    ((target && document.getElementById(revokeId(target))) || document.getElementById(headingId))?.focus();
  });

  // Account management needs the server (offline mode, section 6.2); it goes after what waits on this device.
  const offlineNow = useOfflineNow();
  const offlineHintId = `${headingId}-needs-connection`;

  const revoke = async (session: SessionInfo) => {
    if (busyId || offlineNow) return;
    setBusyId(session.id);
    setActionError(null);
    try {
      const left = (m: string) => {
        setActionError(m);
        announce(m, 'assertive');
      };
      if (!(await drainBeforeOnlineWrite({ onDraining: (m) => announce(m, 'polite'), onLeft: left }))) return;
      await authApi.revokeSession(session.id);
      // Move the focus only when it was on this device's button (or already lost to <body>).
      const active = document.activeElement;
      if (!active || active === document.body || active.id === revokeId(session.id)) {
        const others = (sessions ?? []).filter((s) => !s.current);
        const at = others.findIndex((s) => s.id === session.id);
        const next = others[at + 1] ?? others[at - 1];
        focusAfterRevoke.current = next ? next.id : '';
      }
      setData((list) => (Array.isArray(list) ? list.filter((s) => s.id !== session.id) : list));
      announce(ST.deviceRevoked(deviceLabel(session)), 'polite');
    } catch (e) {
      const message = errorMessage(e);
      setActionError(message);
      announce(message, 'assertive');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby={headingId} className="stack-sm">
      <h3 id={headingId} tabIndex={-1}>
        {ST.devices}
      </h3>
      <p className="text-muted text-small">{ST.devicesHint}</p>
      <NeedsConnectionHint id={offlineHintId} />
      {loading && <Spinner />}
      {error && <Alert kind="error">{error}</Alert>}
      {actionError && <Alert kind="error" role="none">{actionError}</Alert>}
      {sessions && sessions.length === 0 && <p>{ST.noDevices}</p>}
      {sessions && sessions.length > 0 && (
        <ul className="sessions-list">
          {sessions.map((session) => {
            const label = deviceLabel(session);
            return (
              <li className="sessions-list__item" key={session.id}>
                <div className="sessions-list__main">
                  <span>{label}</span>
                  {session.current && <Badge kind="primary">{ST.currentDevice}</Badge>}
                  {session.rememberMe && <Badge>{ST.remembered}</Badge>}
                </div>
                {!session.current && (
                  <Button
                    id={revokeId(session.id)}
                    variant="secondary"
                    size="sm"
                    loading={busyId === session.id}
                    disabled={offlineNow}
                    aria-describedby={offlineNow ? offlineHintId : undefined}
                    aria-label={ST.revokeName(label)}
                    onClick={() => void revoke(session)}
                  >
                    {ST.revoke}
                  </Button>
                )}
                <dl className="sessions-list__meta">
                  <dt>{ST.connectedAt}</dt>
                  <dd>{formatTimestamp(session.createdAt)}</dd>
                  <dt>{ST.lastSeen}</dt>
                  <dd>{formatTimestamp(session.lastSeenAt)}</dd>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
