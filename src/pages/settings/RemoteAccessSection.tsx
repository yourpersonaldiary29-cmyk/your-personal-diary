/**
 * "Remote access" card of the Settings page (right after the Privacy card).
 *
 * Lets the owner reach the diary from anywhere at their DuckDNS name over
 * HTTPS, while the diary itself stays on this computer (docs/API.md "גישה
 * מרחוק", server/src/remote/). Opt-in and off by default. Shown only on the
 * computer itself (`server.info().isLocalRequest`): the remote endpoints answer
 * loopback requests only.
 *
 * Ownership: remote access belongs to the owner of this computer's diary - the
 * account created first on it, from the start (or the account that set it up
 * before that rule existed). Every other account gets `isRemoteOwner: false`
 * from GET /api/server/settings and the card is not rendered at all (it does
 * not even ask for the status - useOwnerCard); the server would answer it with
 * 403 FORBIDDEN ('server.remote.notOwner'), which also hides the card. For the
 * owner the card has three modes:
 *   - setup   nothing configured yet: the connection details form (DuckDNS name,
 *             token - write-only, the server only says whether one is saved -,
 *             router port, UPnP, the on/off switch) with the account password
 *             right above Save.
 *   - locked  configured (a token is saved, and a certificate exists or remote
 *             access is on): a read-only summary, "Test connection" and
 *             "Renew certificate" (while on), the setup steps, the address with
 *             its copy button and QR code - and "Change settings".
 *   - edit    "Change settings" asks for the account password in a dialog (it
 *             is verified at once) and only then reveals the form, with Cancel /
 *             Save. Save sends that password with the PUT (the server checks it
 *             again) and locks the card again.
 * The verified password lives in memory only while editing; locking the app
 * (Ctrl+L) or leaving the page forgets it.
 *
 * The setup steps are reported by the server (icon + words, never colour alone;
 * polled while the server is busy); the instructions include manual port
 * forwarding, followed by the privacy note.
 *
 * Interplay with the Privacy card: remote access makes outbound connections
 * (DuckDNS, Let's Encrypt), so saving it switched on turns offline privacy mode
 * off (announced). The last status is published to remoteAccessStore so the
 * Privacy card can ask before turning offline mode on while remote access is on.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { formatTime } from '@shared/i18n';
import type { RemoteCheckState, RemoteSettingsPatch, RemoteStatus, RemoteStepState, RemoteTestResult } from '@shared/types';
import { server as serverApi, setOfflinePrivacyMode } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DefinitionList, type DefinitionItem } from '@/components/ui/DefinitionList';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TextInput } from '@/components/ui/TextInput';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';
import { useLock } from '@/context/LockContext';
import { useSettings } from '@/context/SettingsContext';
import { useApi } from '@/hooks/useApi';
import { getCurrentLocale } from '@/i18n/runtime';
import { formatLongDate, formatTimestamp, nowHHMM, toIsoDate, todayIso } from '@/utils/dates';
import { errorCode, errorMessage } from '@/utils/errors';
import { encodeQr, qrSvgPath, qrViewSize } from '@/utils/qr';
import { copyText } from './clipboard';
import { publishRemoteStatus, useRemoteStatus } from './remoteAccessStore';
import { DEFAULT_REMOTE_HOSTNAME, RT, remoteMessage } from './remoteTexts';
import { ST } from './texts';
import { useOwnerCard } from './useOwnerCard';
import './remote-access.css';

export const REMOTE_ACCESS_CHECKBOX_ID = 'settings-remote-access';
export const REMOTE_HOSTNAME_ID = 'settings-remote-hostname';
export const REMOTE_TOKEN_ID = 'settings-remote-token';
export const REMOTE_PORT_ID = 'settings-remote-port';
export const REMOTE_UPNP_ID = 'settings-remote-upnp';
export const REMOTE_PASSWORD_ID = 'settings-remote-password';
export const REMOTE_CHANGE_BUTTON_ID = 'settings-remote-change';

/** Poll interval while the server is setting remote access up, and while it is on (background retries / renewals). */
export const REMOTE_POLL_BUSY_MS = 2500;
export const REMOTE_POLL_IDLE_MS = 30000;

const DEFAULT_PUBLIC_PORT = 443;
const HOSTNAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.duckdns\.org$/;
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalises what the user typed into a DuckDNS host name: lower case, no
 * scheme / path / port, and '.duckdns.org' appended to a bare name.
 */
export function normaliseRemoteHostname(raw: string): string {
  let host = raw.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.split(/[/?#]/)[0];
  host = host.replace(/:\d*$/, '').replace(/\.+$/, '');
  if (host && !host.includes('.')) host = `${host}.duckdns.org`;
  return host;
}

/** True for a name this app can manage: '<sub>.duckdns.org'. */
export function isValidRemoteHostname(host: string): boolean {
  return HOSTNAME_RE.test(host);
}

/** True for a DuckDNS token (8-4-4-4-12 hexadecimal). */
export function isValidDuckDnsToken(token: string): boolean {
  return TOKEN_RE.test(token.trim());
}

/**
 * Remote access is configured - and the card locked - once a DuckDNS token is
 * saved and a certificate was obtained or remote access is on.
 */
export function isRemoteConfigured(status: RemoteStatus): boolean {
  return status.tokenSet && (status.certificate !== null || status.enabled);
}

/** The server refuses this account (another account owns remote access) or has no remote access at all. */
function isRefused(e: unknown): boolean {
  return errorCode(e) === 'FORBIDDEN';
}

/** Short local time for today's events, date + time otherwise. */
function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return toIsoDate(d) === todayIso() ? formatTime(getCurrentLocale(), nowHHMM(d)) : formatTimestamp(iso);
}

const STATE_ICONS: Record<RemoteStepState | RemoteCheckState, string> = {
  idle: '○',
  running: '…',
  ok: '✓',
  error: '✗',
  warning: '⚠',
  skipped: '–',
};

interface StatusItemProps {
  state: RemoteStepState | RemoteCheckState;
  name: string;
  message: string;
  at?: string | null;
}

/** One step / check: a shape icon, the name, the state in words and the server's message. */
function StatusItem({ state, name, message, at }: StatusItemProps) {
  const stateLabel = RT.stateLabel(state);
  return (
    <li className={`remote-status remote-status--${state}`}>
      <span className="remote-status__icon" aria-hidden="true">
        {state === 'running' ? <span className="spinner__circle" /> : STATE_ICONS[state]}
      </span>
      <span className="remote-status__body">
        <span className="remote-status__head">
          <span className="remote-status__name">{name}</span>
          <span className="remote-status__state">{stateLabel}</span>
        </span>
        {message !== stateLabel && <span className="remote-status__message">{message}</span>}
        {at && <span className="remote-status__time">{RT.stepAt(when(at))}</span>}
      </span>
    </li>
  );
}

/** The address as a QR code (inline SVG, black on white whatever the theme). */
export function RemoteQrCode({ url }: { url: string }) {
  const qr = useMemo(() => {
    try {
      return encodeQr(url);
    } catch {
      return null;
    }
  }, [url]);
  if (!qr) return null;
  const view = qrViewSize(qr);
  return (
    <svg
      className="remote-qr"
      role="img"
      aria-label={RT.qrLabel(url)}
      viewBox={`0 0 ${view} ${view}`}
      width="200"
      height="200"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={view} height={view} fill="#ffffff" />
      <path d={qrSvgPath(qr)} fill="#000000" />
    </svg>
  );
}

interface FormErrors {
  hostname?: string;
  token?: string;
  port?: string;
  password?: string;
}

type Pending = 'save' | 'test' | 'renew' | null;
type Mode = 'setup' | 'locked' | 'edit';

/** The card itself (rendered only on the computer; see RemoteAccessSection). */
function RemoteAccessCard() {
  const { announce } = useAnnouncer();
  const { settings, update } = useSettings();
  const { verifyPassword } = useAuth();
  const { locked: appLocked } = useLock();
  const status = useRemoteStatus();
  // Another account owns remote access (or the server has none): the card stays away.
  const [refused, setRefused] = useState(false);
  const load = useApi(() => serverApi.remote.get(), [], {
    onSuccess: publishRemoteStatus,
    onError: (e) => {
      if (!isRefused(e)) return;
      setRefused(true);
      // A status still in the shared store (e.g. from a save that finished after the owner's card
      // was gone) is not this account's to see - nor for the Privacy card to act on.
      publishRemoteStatus(null);
    },
  });
  const detailsId = useId();
  const currentId = useId();
  const statusId = useId();
  const testId = useId();
  const urlId = useId();
  const howId = useId();

  const [hostname, setHostname] = useState(DEFAULT_REMOTE_HOSTNAME);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [port, setPort] = useState<number | null>(DEFAULT_PUBLIC_PORT);
  const [upnp, setUpnp] = useState(true);
  const [enabledChoice, setEnabledChoice] = useState(false);
  /** The password field of the first setup. */
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formLoaded, setFormLoaded] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<RemoteTestResult | null>(null);
  const [pollTick, setPollTick] = useState(0);
  // "Change settings": the password dialog, then the unlocked form.
  const [editing, setEditing] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  /** The verified account password while the form is unlocked (memory only; sent with Save). */
  const unlockedPassword = useRef('');
  /** Re-asking for the password in the middle of an edit keeps what the user typed. */
  const keepFormOnUnlock = useRef(false);
  /** Where focus goes after the next render (the element it was on may have disappeared). */
  const focusNext = useRef<string | null>(null);
  const pendingRef = useRef<Pending>(null);
  const alive = useRef(true);
  const prevBusy = useRef<boolean | null>(null);

  const configured = status ? isRemoteConfigured(status) : false;
  const mode: Mode = !configured ? 'setup' : editing ? 'edit' : 'locked';

  const syncForm = (s: RemoteStatus) => {
    setHostname(s.hostname || DEFAULT_REMOTE_HOSTNAME);
    setPort(s.publicPort || DEFAULT_PUBLIC_PORT);
    setUpnp(s.upnp);
    setEnabledChoice(s.enabled);
    setToken('');
    setShowToken(false);
    setErrors({});
  };

  // Forget the status when the card goes away (the Privacy card then stops asking).
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      unlockedPassword.current = '';
      publishRemoteStatus(null);
    };
  }, []);

  // Fill the form once, from the first status this card loaded itself.
  useEffect(() => {
    if (status && load.data && !formLoaded) {
      syncForm(status);
      setFormLoaded(true);
    }
  }, [status, load.data, formLoaded]);

  // Poll while the server works (and slowly while remote access is on).
  useEffect(() => {
    if (!status || (!status.busy && !status.enabled)) return;
    const timer = window.setTimeout(
      () => {
        serverApi.remote.get().then(
          (next) => {
            if (alive.current) publishRemoteStatus(next);
          },
          (e) => {
            if (!alive.current) return;
            if (isRefused(e)) {
              setRefused(true);
              publishRemoteStatus(null);
            } else setPollTick((t) => t + 1);
          },
        );
      },
      status.busy ? REMOTE_POLL_BUSY_MS : REMOTE_POLL_IDLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [status, pollTick]);

  // Announce the end of a setup run.
  useEffect(() => {
    if (!status) return;
    const wasBusy = prevBusy.current;
    prevBusy.current = status.busy;
    if (wasBusy !== true || status.busy || !status.enabled) return;
    if (status.lastError) announce(RT.failed(remoteMessage(status.lastError, RT.stateLabel('error'))), 'assertive');
    else if (status.urls[0]) announce(RT.ready(status.urls[0]), 'polite');
  }, [status, announce]);

  // Locking the app (Ctrl+L) locks this card too and forgets any password.
  useEffect(() => {
    if (!appLocked) return;
    unlockedPassword.current = '';
    keepFormOnUnlock.current = false;
    setPassword('');
    setUnlockOpen(false);
    setEditing(false);
  }, [appLocked]);

  // Runs after the dialog (a child) has tried to give focus back to its opener.
  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    document.getElementById(id)?.focus();
  });

  const begin = (what: Exclude<Pending, null>): boolean => {
    if (pendingRef.current) return false;
    pendingRef.current = what;
    setPending(what);
    setOpError(null);
    return true;
  };
  const end = () => {
    pendingRef.current = null;
    setPending(null);
  };
  const fail = (e: unknown) => {
    const message = errorMessage(e);
    setOpError(message);
    announce(message, 'assertive');
  };
  const applyStatus = (s: RemoteStatus, resyncForm = true) => {
    // An answer that arrives after the card is gone must not linger in the shared store.
    if (!alive.current) return;
    publishRemoteStatus(s);
    if (resyncForm) syncForm(s);
  };

  /** Checks the form; returns the settings to send, or null (errors shown, first invalid field focused). */
  const validate = (requireToken: boolean, requirePassword: boolean): RemoteSettingsPatch | null => {
    const found: FormErrors = {};
    const host = normaliseRemoteHostname(hostname);
    if (!isValidRemoteHostname(host)) found.hostname = RT.hostnameInvalid;
    const tk = token.trim();
    if (tk && !isValidDuckDnsToken(tk)) found.token = RT.tokenInvalid;
    else if (!tk && requireToken && !status?.tokenSet) found.token = RT.tokenMissing;
    if (port === null || !Number.isInteger(port) || port < 1 || port > 65535) found.port = RT.portInvalid;
    if (requirePassword && !password) found.password = RT.passwordMissing;
    setErrors(found);
    const invalid = (['hostname', 'token', 'port', 'password'] as const).filter((k) => found[k]);
    if (invalid.length) {
      announce(T.fixErrors(invalid.length), 'assertive');
      const firstId = { hostname: REMOTE_HOSTNAME_ID, token: REMOTE_TOKEN_ID, port: REMOTE_PORT_ID, password: REMOTE_PASSWORD_ID }[invalid[0]];
      document.getElementById(firstId)?.focus();
      return null;
    }
    const patch: RemoteSettingsPatch = { hostname: host, publicPort: port as number, upnp, enabled: enabledChoice };
    if (tk) patch.duckdnsToken = tk;
    return patch;
  };

  const openUnlock = (keepForm: boolean, error: string | null = null) => {
    keepFormOnUnlock.current = keepForm;
    setUnlockError(error);
    setUnlockOpen(true);
  };

  const closeUnlock = () => {
    if (unlocking) return;
    keepFormOnUnlock.current = false;
    setUnlockOpen(false);
  };

  /** The dialog's Confirm: the password is checked now, and the form opens only when it is right. */
  const onConfirmUnlock = async (typed?: string) => {
    const pw = typed ?? '';
    if (unlocking) return;
    if (!pw) {
      setUnlockError(RT.passwordMissing);
      return;
    }
    setUnlocking(true);
    setUnlockError(null);
    try {
      if (!(await verifyPassword(pw))) {
        setUnlockError(RT.wrongPassword);
        return;
      }
      if (!alive.current) return;
      unlockedPassword.current = pw;
      if (!keepFormOnUnlock.current && status) syncForm(status);
      keepFormOnUnlock.current = false;
      setOpError(null);
      setUnlockOpen(false);
      setEditing(true);
      focusNext.current = REMOTE_HOSTNAME_ID;
      announce(RT.unlocked, 'polite');
    } catch (e) {
      setUnlockError(errorMessage(e));
    } finally {
      if (alive.current) setUnlocking(false);
    }
  };

  const onCancelEdit = () => {
    if (pendingRef.current === 'save') return;
    unlockedPassword.current = '';
    if (status) syncForm(status);
    setOpError(null);
    setEditing(false);
    focusNext.current = REMOTE_CHANGE_BUTTON_ID;
    announce(RT.editCancelled, 'polite');
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!status) return;
    const setup = mode === 'setup';
    const patch = validate(enabledChoice, setup);
    if (!patch) return;
    const pw = setup ? password : unlockedPassword.current;
    if (!pw) {
      // Unlocked form without a verified password (it was wrong on the last Save): ask again.
      openUnlock(true);
      return;
    }
    if (!begin('save')) return;
    const wasEnabled = status.enabled;
    const liftOffline = enabledChoice && settings.offlinePrivacyMode;
    try {
      if (liftOffline) {
        // Remote access needs outbound connections: lift the guard first, then save the setting.
        setOfflinePrivacyMode(false);
        await update({ offlinePrivacyMode: false });
      }
      const saved = await serverApi.remote.put({ ...patch, password: pw });
      applyStatus(saved);
      setPassword('');
      unlockedPassword.current = '';
      setEditing(false);
      if (!saved.enabled) setTestResult(null);
      const nowLocked = isRemoteConfigured(saved);
      if (nowLocked) focusNext.current = REMOTE_CHANGE_BUTTON_ID;
      let message: string;
      if (saved.enabled && !wasEnabled) message = liftOffline ? `${RT.enabled} ${RT.offlineTurnedOff}` : RT.enabled;
      else if (!saved.enabled && wasEnabled) message = RT.disabled;
      else message = nowLocked ? RT.savedLocked : RT.saved;
      announce(message, 'polite');
    } catch (e) {
      if (liftOffline) {
        setOfflinePrivacyMode(true);
        await update({ offlinePrivacyMode: true }).catch(() => undefined);
      }
      if (errorCode(e) === 'WRONG_PASSWORD') {
        if (setup) {
          setErrors({ password: RT.wrongPassword });
          announce(RT.wrongPassword, 'assertive');
          document.getElementById(REMOTE_PASSWORD_ID)?.focus();
        } else {
          // The password changed since the form was unlocked: ask again, keep the edits.
          unlockedPassword.current = '';
          openUnlock(true, RT.wrongPassword);
        }
      } else {
        fail(e);
      }
    } finally {
      end();
    }
  };

  const onTest = async () => {
    if (!begin('test')) return;
    try {
      const result = await serverApi.remote.test();
      setTestResult(result);
      const counted = result.checks.filter((c) => c.state !== 'skipped');
      announce(RT.testDone(counted.filter((c) => c.state === 'ok').length, counted.length), 'polite');
    } catch (e) {
      fail(e);
    } finally {
      end();
    }
  };

  const onRenew = async () => {
    if (!begin('renew')) return;
    try {
      applyStatus(await serverApi.remote.renew(), false);
      announce(RT.renewStarted, 'polite');
    } catch (e) {
      fail(e);
    } finally {
      end();
    }
  };

  const copy = async (url: string) => {
    const ok = await copyText(url);
    announce(ok ? ST.copied(url) : ST.copyFailed, ok ? 'polite' : 'assertive');
  };

  if (refused) return null;
  if (!status || !load.data) {
    // Nothing until the server has answered this card's own request (no flash for accounts it will
    // refuse, and never a status left in the shared store by an earlier visit).
    if (!load.error) return null;
    return (
      <Card title={RT.title} className="remote-access">
        <div className="stack">
          <p>{RT.intro}</p>
          <Alert kind="error">{load.error}</Alert>
        </div>
      </Card>
    );
  }

  const url = status.urls[0] ?? '';
  const certificate = status.certificate;
  const certificateText = certificate ? (
    <>
      {RT.certificateValid(formatLongDate(toIsoDate(new Date(certificate.validTo))), certificate.daysLeft, certificate.issuer)}
      {certificate.staging && (
        <>
          {' '}
          <strong>{RT.certificateStaging}</strong>
        </>
      )}
    </>
  ) : (
    RT.noCertificate
  );

  const summary: DefinitionItem[] = [
    { term: RT.summaryState, value: status.enabled ? RT.summaryOn : RT.summaryOff },
    { term: RT.hostname, value: <span dir="ltr">{status.hostname}</span> },
    { term: RT.token, value: RT.summaryTokenSaved },
    { term: RT.publicPort, value: <span dir="ltr">{String(status.publicPort)}</span> },
    { term: RT.summaryUpnp, value: status.upnp ? RT.summaryUpnpAuto : RT.summaryUpnpManual },
  ];
  // While on, the certificate is part of the status below.
  if (!status.enabled) summary.push({ term: RT.certificate, value: certificateText });

  return (
    <Card title={RT.title} className="remote-access">
      <div className="stack">
        <p>{RT.intro}</p>
        <p className="remote-access__owner">{status.hasOwner ? RT.ownerNote : RT.setupOwnerNote}</p>
        {opError && <Alert kind="error" role="none">{opError}</Alert>}

        {mode === 'locked' && (
          <section aria-labelledby={currentId} className="stack-sm">
            <h3 id={currentId}>{RT.currentTitle}</h3>
            <DefinitionList aria-label={RT.currentTitle} items={summary} />
            <p className="text-muted">{RT.lockedHint}</p>
            <div className="cluster">
              {status.enabled && (
                <Button variant="secondary" loading={pending === 'test'} onClick={() => void onTest()}>
                  {RT.test}
                </Button>
              )}
              <Button id={REMOTE_CHANGE_BUTTON_ID} variant="secondary" aria-haspopup="dialog" onClick={() => openUnlock(false)}>
                {RT.change}
              </Button>
            </div>
          </section>
        )}

        {mode !== 'locked' && (
          <form className="form stack-sm" onSubmit={(e) => void onSave(e)} noValidate aria-labelledby={detailsId}>
            <h3 id={detailsId}>{RT.detailsTitle}</h3>
            <Field id={REMOTE_HOSTNAME_ID} label={RT.hostname} hint={RT.hostnameHint} error={errors.hostname ?? null}>
              {(a11y) => (
                <TextInput
                  {...a11y}
                  dir="ltr"
                  className="remote-access__ltr"
                  value={hostname}
                  placeholder={DEFAULT_REMOTE_HOSTNAME}
                  onChange={(e) => setHostname(e.currentTarget.value)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="url"
                />
              )}
            </Field>
            <Field
              id={REMOTE_TOKEN_ID}
              label={RT.token}
              hint={
                status.tokenSet ? (
                  <span className="remote-access__token-saved">
                    <span aria-hidden="true">✓ </span>
                    {RT.tokenSaved}
                  </span>
                ) : (
                  RT.tokenHint
                )
              }
              error={errors.token ?? null}
            >
              {(a11y) => (
                <div className="password-field">
                  <input
                    {...a11y}
                    type={showToken ? 'text' : 'password'}
                    dir="ltr"
                    className="input remote-access__ltr"
                    value={token}
                    onChange={(e) => setToken(e.currentTarget.value)}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  <button type="button" className="btn btn--secondary" aria-pressed={showToken} onClick={() => setShowToken((v) => !v)}>
                    {RT.showToken}
                  </button>
                </div>
              )}
            </Field>
            <NumberInput
              id={REMOTE_PORT_ID}
              label={RT.publicPort}
              hint={RT.publicPortHint}
              value={port}
              onChange={setPort}
              min={1}
              max={65535}
              step={1}
              inputMode="numeric"
              error={errors.port ?? null}
            />
            <Checkbox id={REMOTE_UPNP_ID} label={RT.upnp} hint={RT.upnpHint} checked={upnp} onChange={setUpnp} />
            <Checkbox id={REMOTE_ACCESS_CHECKBOX_ID} label={RT.switchLabel} hint={RT.switchHint} checked={enabledChoice} onChange={setEnabledChoice} />
            {mode === 'setup' && (
              <Field id={REMOTE_PASSWORD_ID} label={RT.password} hint={RT.passwordHint} error={errors.password ?? null} required>
                {(a11y) => (
                  <PasswordInput
                    {...a11y}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.currentTarget.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    autoComplete="current-password"
                  />
                )}
              </Field>
            )}
            <div className="cluster">
              <Button type="submit" loading={pending === 'save'}>
                {T.save}
              </Button>
              {mode === 'edit' && (
                <Button variant="secondary" onClick={onCancelEdit}>
                  {T.cancel}
                </Button>
              )}
            </div>
          </form>
        )}

        {testResult && (
          <section aria-labelledby={testId} className="stack-sm">
            <h3 id={testId}>{RT.testTitle}</h3>
            <ul className="remote-status-list">
              {testResult.checks.map((check) => (
                <StatusItem
                  key={check.id}
                  state={check.state}
                  name={RT.checkName(check.id)}
                  message={remoteMessage(check, RT.stateLabel(check.state))}
                />
              ))}
            </ul>
          </section>
        )}

        {status.enabled && (
          <section aria-labelledby={statusId} className="stack-sm" aria-busy={status.busy || undefined}>
            <h3 id={statusId}>{RT.statusTitle}</h3>
            {status.busy && (
              <p className="remote-access__busy">
                <span className="spinner__circle" aria-hidden="true" />
                <span>{RT.busy}</span>
              </p>
            )}
            <ul className="remote-status-list">
              {status.steps.map((step) => (
                <StatusItem
                  key={step.id}
                  state={step.state}
                  name={RT.stepName(step.id)}
                  message={remoteMessage(step, RT.stateLabel(step.state))}
                  at={step.at}
                />
              ))}
            </ul>
            {status.lastError && !status.busy && (
              <Alert kind="error" role="none">
                {RT.lastError(remoteMessage(status.lastError, RT.stateLabel('error')))}
              </Alert>
            )}
            {status.nextRetryAt && !status.busy && <p>{RT.nextRetry(when(status.nextRetryAt))}</p>}
            <DefinitionList
              aria-label={RT.statusTitle}
              items={[
                {
                  term: RT.publicIp,
                  value: status.publicIp ? <span dir="ltr">{status.publicIp}</span> : RT.unknown,
                },
                { term: RT.certificate, value: certificateText },
              ]}
            />
            <div className="cluster">
              <Button variant="secondary" loading={pending === 'renew'} onClick={() => void onRenew()}>
                {RT.renew}
              </Button>
            </div>
          </section>
        )}

        {status.enabled && (
          <section aria-labelledby={urlId} className="stack-sm">
            <h3 id={urlId}>{RT.urlTitle}</h3>
            {url ? (
              <>
                <p>{RT.urlHint}</p>
                <div className="lan-urls__item">
                  <code className="lan-urls__url">{url}</code>
                  <Button variant="secondary" size="sm" aria-label={ST.copyName(url)} onClick={() => void copy(url)}>
                    {ST.copy}
                  </Button>
                </div>
                <figure className="remote-access__qr">
                  <RemoteQrCode url={url} />
                  <figcaption>{RT.qrHint}</figcaption>
                </figure>
              </>
            ) : (
              <p>{RT.noUrl}</p>
            )}
          </section>
        )}

        <section aria-labelledby={howId} className="stack-sm">
          <h3 id={howId}>{RT.instructionsTitle}</h3>
          <ol>
            {RT.instructions(status.publicPort || DEFAULT_PUBLIC_PORT, status.tlsPort ?? (status.publicPort || DEFAULT_PUBLIC_PORT), status.lanIps[0] ?? null).map(
              (step) => (
                <li key={step}>{step}</li>
              ),
            )}
          </ol>
        </section>
        <p className="remote-access__privacy">{RT.privacyNote}</p>
      </div>
      <ConfirmDialog
        open={unlockOpen}
        title={RT.unlockTitle}
        message={RT.unlockMessage}
        requirePassword
        onConfirm={(pw) => void onConfirmUnlock(pw)}
        onCancel={closeUnlock}
        loading={unlocking}
        error={unlockError}
      />
    </Card>
  );
}

/**
 * The Remote access card, or nothing when the page is not opened on the computer
 * itself (phone on the LAN, or the diary opened over the internet), or when
 * another account on this computer owns remote access (`isRemoteOwner: false`,
 * see useOwnerCard - or a 403 from an older server).
 */
export function RemoteAccessSection() {
  const allowed = useOwnerCard('isRemoteOwner');
  // Without the card, a status still in the shared store (e.g. from the owner's earlier visit in this
  // window) is not this account's to see - nor for the Privacy card to act on.
  useEffect(() => {
    if (!allowed) publishRemoteStatus(null);
  }, [allowed]);
  if (!allowed) return null;
  return <RemoteAccessCard />;
}
