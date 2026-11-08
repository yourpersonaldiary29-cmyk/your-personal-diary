/**
 * "Delete account" - the last card of the Settings page and the only way to
 * delete an account (POST /api/auth/delete-account).
 *
 * The card warns that the account is deleted for good together with its
 * diary, habits, settings and sessions (backup files saved elsewhere are not
 * affected). Its danger button opens a dialog that repeats the warning, asks
 * for the account password and for "I understand this cannot be undone"; the
 * confirm button stays disabled until both are given. When the signed-in
 * account owns remote access and/or the e-mail for password reset
 * (`ServerSettings.isRemoteOwner` / `isMailOwner`, read when the dialog opens),
 * one more line says what the server does to them: they are turned off and
 * their settings erased (routes/auth.ts -> releaseOwner), and the oldest
 * remaining account becomes their owner.
 *
 * That is the LOCAL server. On the Your Personal Diary server (hosted mode:
 * `useHostedServer`, or a settings answer that carries the hosted-only
 * `isServerOwner`) the owner is `DIARY_OWNER_ID` and nothing else - deleting it
 * erases the mail settings and promotes nobody (server/src/hosted/owner.ts,
 * docs/API.md "מצב מארח" -> "בעלות"). Its owner (`isMailOwner` / `isServerOwner`)
 * therefore gets the hosted line instead (`settings.deleteAccount.ownerHosted`):
 * the reset e-mails stop, nobody gets the Server card or the server archive, and
 * a re-registered account needs DIARY_OWNER_ID set again by the operator.
 *
 * A wrong password (400 WRONG_PASSWORD) stays in the dialog at the password
 * field. After the deletion: a toast and a polite announcement, the session is
 * forgotten on this device (token; the remembered sign-in name when it is this
 * account's; the recent search questions), and the app goes to the login page -
 * or to registration when no account is left on this computer.
 *
 * Automatic offline mode (docs/android-tasks/OFFLINE-DESIGN.md sections 3.7, 4.8, 6.2): deleting needs
 * the server (the button is disabled without a connection); the dialog adds how many changes not yet
 * uploaded go with the account and that changes still waiting on other devices are lost; after the
 * deletion this device's offline copy is wiped explicitly (`offline.wipeAccount`).
 */
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth as authApi, server as serverApi } from '@/api';
import { Dialog } from '@/components/a11y/Dialog';
import { LiveRegion } from '@/components/a11y/LiveRegion';
import { Alert } from '@/components/ui/Alert';
import { NeedsConnectionHint } from '@/components/sync/NeedsConnection';
import { useOfflineNow, useSyncEnabled } from '@/components/sync/hooks';
import { changesOnDevice, wipeAccountQuietly } from '@/components/sync/syncGate';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';
import { useHostedServer } from '@/context/ConnectionContext';
import { useToast } from '@/context/ToastContext';
import { tr } from '@/i18n/runtime';
import { errorCode, errorMessage } from '@/utils/errors';
import { forgetAccountOnThisDevice } from '@/utils/deviceData';
import { clearLastUsername, getLastUsername } from '@/utils/last-username';
import { ST } from './texts';

/** Which owner-only settings of the server the signed-in account owns (and loses with the account). */
export interface OwnedSettings {
  /** Remote access of this computer (local server; the hosted server reports false to everyone). */
  remote: boolean;
  /** The e-mail for password reset. */
  mail: boolean;
  /** The Server card and the server archive (`isServerOwner`; only the hosted server reports it). */
  server: boolean;
  /** The answer carried `isServerOwner` - a field only the hosted Your Personal Diary server sends. */
  hostedAnswer: boolean;
}

const OWNS_NOTHING: OwnedSettings = { remote: false, mail: false, server: false, hostedAnswer: false };

/**
 * The dialog line about owned settings, or null when the account owns none. `hosted`: the UI talks to
 * the Your Personal Diary server, whose owner (DIARY_OWNER_ID) nobody inherits - never the local wording
 * ("on this computer", "the oldest remaining account becomes the owner") there.
 */
export function ownerNote(owned: OwnedSettings, hosted = false): string | null {
  if (hosted || owned.hostedAnswer) return owned.mail || owned.server ? ST.deleteAccountOwnerHosted : null;
  if (owned.remote && owned.mail) return ST.deleteAccountOwnerBoth;
  if (owned.remote) return ST.deleteAccountOwnerRemote;
  if (owned.mail) return ST.deleteAccountOwnerMail;
  return null;
}

/** Reads the owner flags; a server that cannot say (older version, error) gets no line. */
async function loadOwnedSettings(): Promise<OwnedSettings> {
  try {
    const s = await serverApi.getSettings();
    return {
      remote: s?.isRemoteOwner === true,
      mail: s?.isMailOwner === true,
      server: s?.isServerOwner === true,
      hostedAnswer: typeof s?.isServerOwner === 'boolean',
    };
  } catch {
    return OWNS_NOTHING;
  }
}

/**
 * Where to go once the account is gone: registration when no account is left
 * on this computer, the login page otherwise - also wherever the list cannot
 * be read (it is answered on the computer itself only).
 */
async function pageAfterDeletion(): Promise<string> {
  try {
    const res = await authApi.accounts();
    if (res && Array.isArray(res.accounts) && res.accounts.length === 0) return PATHS.register;
  } catch {
    /* phone / home network / older server: the list is not available here */
  }
  return PATHS.login;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Forgets what this device kept about the deleted account (the token goes with `endSession`). */
function forgetOnThisDevice(userId: string, username: string, email: string | undefined): void {
  const remembered = getLastUsername();
  if (remembered && (same(remembered, username) || (!!email && same(remembered, email)))) clearLastUsername();
  forgetAccountOnThisDevice(userId);
}

/** `template(name)` with the name isolated for bidirectional text (a Latin name inside Hebrew / Arabic). */
function withIsolatedName(template: (name: string) => string, name: string): ReactNode {
  const mark = '\u0000';
  const [before, after = ''] = template(mark).split(mark);
  return (
    <>
      {before}
      <bdi>{name}</bdi>
      {after}
    </>
  );
}

export function DeleteAccountSection() {
  const { user, withPasswordCheck, endSession } = useAuth();
  const toast = useToast();
  const { announce } = useAnnouncer();
  const navigate = useNavigate();
  const base = useId();
  const dialogId = `delete-account-${base}`;
  const warningId = `${dialogId}-warning`;
  const ownerId = `${dialogId}-owner`;
  const passwordId = `${dialogId}-password`;
  const understandId = `${dialogId}-understand`;

  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [owned, setOwned] = useState<OwnedSettings>(OWNS_NOTHING);
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const mounted = useRef(true);
  const syncEnabled = useSyncEnabled();
  const offlineNow = useOfflineNow();
  // The Your Personal Diary server: its owner line is the hosted one (see the module comment).
  const hosted = useHostedServer();
  const offlineId = `${dialogId}-offline`;
  const offlineHintId = `${dialogId}-needs-connection`;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!user) return null;

  const ready = password !== '' && understood;
  const note = ownerNote(owned, hosted);

  const openDialog = async () => {
    if (opening || open) return;
    setOpening(true);
    // Read before opening, so the owner line is already there when focus moves into the dialog.
    const flags = await loadOwnedSettings();
    if (!mounted.current) return;
    setOwned(flags);
    setPendingCount(changesOnDevice(user.id));
    setPassword('');
    setUnderstood(false);
    setPasswordError(null);
    setServerError(null);
    setLiveMessage('');
    setOpening(false);
    setOpen(true);
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setPasswordError(null);
    setServerError(null);
    try {
      await withPasswordCheck(() => authApi.deleteAccount(password));
    } catch (err) {
      if (!mounted.current) return;
      setBusy(false);
      if (errorCode(err) === 'WRONG_PASSWORD') {
        setPasswordError(ST.deleteAccountWrongPassword);
        setLiveMessage(ST.deleteAccountWrongPassword);
        document.getElementById(passwordId)?.focus();
      } else {
        // The Alert (role="alert") announces it; the live region is for the field error only.
        setServerError(errorMessage(err));
        setLiveMessage('');
      }
      return;
    }
    const next = await pageAfterDeletion();
    const done = ST.deleteAccountDone;
    forgetOnThisDevice(user.id, user.username, user.email);
    // This device's offline copy of the account (outbox, notes, cache, key): explicitly, after the deletion.
    await wipeAccountQuietly(user.id);
    toast.success(done, { announced: true });
    announce(done, 'polite');
    endSession();
    navigate(next, { replace: true });
  };

  return (
    <Card title={ST.deleteAccountTitle} className="delete-account">
      <div className="danger-zone stack-sm">
        <p>{ST.deleteAccountWarning}</p>
        <div>
          <Button
            variant="danger"
            onClick={openDialog}
            loading={opening}
            disabled={offlineNow}
            aria-describedby={offlineNow ? offlineHintId : undefined}
            aria-haspopup="dialog"
          >
            {ST.deleteAccountButton}
          </Button>
          <NeedsConnectionHint id={offlineHintId} />
        </div>
      </div>
      <Dialog
        open={open}
        onClose={close}
        title={withIsolatedName(ST.deleteAccountDialogTitle, user.username)}
        size="sm"
        id={dialogId}
        describedBy={[warningId, note ? ownerId : '', syncEnabled ? offlineId : ''].filter(Boolean).join(' ')}
      >
        <p id={warningId}>
          <strong>{ST.deleteAccountWarning}</strong>
        </p>
        {note && <p id={ownerId}>{note}</p>}
        {syncEnabled && (
          <p id={offlineId} data-testid="delete-account-offline">
            {pendingCount > 0 ? `${tr('shell.sync.deleteAccount.pending', { count: pendingCount })} ` : ''}
            {tr('shell.sync.deleteAccount.otherDevices')}
          </p>
        )}
        {serverError && <Alert kind="error">{serverError}</Alert>}
        <form className="form" onSubmit={onSubmit} noValidate>
          <Field id={passwordId} label={T.password} hint={ST.deleteAccountPasswordHint} error={passwordError} required>
            {(a11y) => (
              <PasswordInput
                {...a11y}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => {
                  setPassword(ev.currentTarget.value);
                  if (passwordError) setPasswordError(null);
                }}
              />
            )}
          </Field>
          <Checkbox id={understandId} label={ST.deleteAccountUnderstand} checked={understood} onChange={setUnderstood} />
          {/* Same order as every dialog (ConfirmDialog): Cancel, then the action. */}
          <div className="form__actions">
            <Button variant="secondary" onClick={close}>
              {T.cancel}
            </Button>
            <Button type="submit" variant="danger" disabled={!ready && !busy} loading={busy}>
              {ST.deleteAccountConfirm}
            </Button>
          </div>
        </form>
        <LiveRegion politeness="assertive" message={liveMessage} />
      </Dialog>
    </Card>
  );
}
