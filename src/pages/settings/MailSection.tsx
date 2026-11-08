/**
 * "E-mail for password reset" card of the Settings page (right after the
 * Remote access card).
 *
 * Password reset by e-mail needs an account the diary can send from - the
 * owner's Gmail address with a Gmail App Password (Google refuses the normal
 * account password over SMTP; the card explains why and lists the steps to
 * create an App Password). The settings live on the server
 * (`GET/PUT /api/server/mail`, docs/API.md "שליחת דואר"); the App Password is
 * write-only - the server keeps it encrypted with the device key and only says
 * whether one is saved (`smtpPasswordSet`).
 *
 * Exactly like the Remote access card (RemoteAccessSection.tsx):
 *   - shown only on the computer itself (`server.info().isLocalRequest`): the
 *     endpoints answer loopback requests only;
 *   - owned by the owner of this computer's diary - the account created first
 *     on it, from the start (or the account that set it up before that rule
 *     existed): every other account gets `isMailOwner: false` from
 *     GET /api/server/settings and the card is not rendered at all (useOwnerCard;
 *     the server would answer it 403 FORBIDDEN 'server.mail.notOwner');
 *   - three modes: `setup` (nothing configured: the form, with the account
 *     password right above Save), `locked` (configured: a read-only summary,
 *     "Send test e-mail" and "Change settings") and `edit` ("Change settings"
 *     asks for the account password in a dialog, verified at once, and only then
 *     opens the form with Cancel / Save; Save sends that password again with the
 *     PUT and locks the card). The verified password stays in memory only while
 *     editing; locking the app (Ctrl+L) or leaving the page forgets it.
 *
 * The form: the switch, the Gmail address (also the sender address), the App
 * Password (PasswordInput) and, under "Advanced", the SMTP server, port and
 * connection security (SSL/TLS on 465 or STARTTLS on 587; switching one moves a
 * default port along). "Send test e-mail" sends a short e-mail to the signed-in
 * owner's own address (`POST /api/server/mail/test`).
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { MailSecurity, MailSettingsPatch, MailSettingsView } from '@shared/types';
import { server as serverApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DefinitionList, type DefinitionItem } from '@/components/ui/DefinitionList';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';
import { useLock } from '@/context/LockContext';
import { useApi } from '@/hooks/useApi';
import { errorCode, errorField, errorMessage } from '@/utils/errors';
import { emailProblem } from '../RegisterPage';
import { DEFAULT_MAIL_ADDRESS, DEFAULT_MAIL_HOST, DEFAULT_MAIL_PORT, MAIL_SECURITY_PORTS, MT } from './mailTexts';
import { useOwnerCard } from './useOwnerCard';
import './mail-settings.css';

export const MAIL_ENABLED_ID = 'settings-mail-enabled';
export const MAIL_ADDRESS_ID = 'settings-mail-address';
export const MAIL_APP_PASSWORD_ID = 'settings-mail-app-password';
export const MAIL_HOST_ID = 'settings-mail-host';
export const MAIL_PORT_ID = 'settings-mail-port';
export const MAIL_SECURITY_ID = 'settings-mail-security';
export const MAIL_PASSWORD_ID = 'settings-mail-password';
export const MAIL_CHANGE_BUTTON_ID = 'settings-mail-change';

const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** 'SMTP.Gmail.com.' -> 'smtp.gmail.com' (the server normalises the same way). */
export function normaliseMailHost(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.$/, '');
}

/** What the server accepts as an SMTP host (after normaliseMailHost): a dotted host name, 'localhost' or an IPv4 address. */
export function isValidMailHost(host: string): boolean {
  if (!host || host.length > 253) return false;
  if (IPV4_RE.test(host) || host === 'localhost') return true;
  const labels = host.split('.');
  return labels.length >= 2 && labels.every((label) => HOST_LABEL_RE.test(label));
}

/** The card is locked once an App Password and the sending address are saved. */
export function isMailConfigured(view: MailSettingsView): boolean {
  return view.smtpPasswordSet && view.username.trim() !== '';
}

/** True for Gmail's SMTP servers (their App Passwords are 16 letters, shown with spaces). */
export function isGmailHost(host: string): boolean {
  return /(^|\.)(gmail|googlemail)\.com$/i.test(host.trim().replace(/\.$/, ''));
}

/** The App Password as sent to the server: trimmed; for Gmail without the spaces Google shows. */
export function normaliseAppPassword(raw: string, host: string): string {
  const trimmed = raw.trim();
  return isGmailHost(host) ? trimmed.replace(/\s+/g, '') : trimmed;
}

/** A Gmail App Password: 16 letters (after removing spaces). */
export function isGmailAppPassword(password: string): boolean {
  return /^[a-z]{16}$/i.test(password);
}

/** The server refuses this account (another account owns the mail settings). */
function isRefused(e: unknown): boolean {
  return errorCode(e) === 'FORBIDDEN';
}

type FieldName = 'address' | 'appPassword' | 'host' | 'port' | 'password';
type FormErrors = Partial<Record<FieldName, string>>;
type Pending = 'save' | 'test' | null;
type Mode = 'setup' | 'locked' | 'edit';

const FIELD_ORDER: FieldName[] = ['address', 'appPassword', 'host', 'port', 'password'];
const FIELD_IDS: Record<FieldName, string> = {
  address: MAIL_ADDRESS_ID,
  appPassword: MAIL_APP_PASSWORD_ID,
  host: MAIL_HOST_ID,
  port: MAIL_PORT_ID,
  password: MAIL_PASSWORD_ID,
};
/** Fields inside the "Advanced" disclosure (opened before one of them is focused). */
const ADVANCED_FIELDS: FieldName[] = ['host', 'port'];

/** Maps a server validation field to the form field that shows it. */
function formFieldOf(serverField: string | null): FieldName | null {
  switch (serverField) {
    case 'username':
    case 'fromAddress':
      return 'address';
    case 'smtpPassword':
      return 'appPassword';
    case 'host':
      return 'host';
    case 'port':
      return 'port';
    default:
      return null;
  }
}

/** The card itself (rendered only on the computer; see MailSection). */
function MailCard() {
  const { announce } = useAnnouncer();
  const { user, verifyPassword } = useAuth();
  const { locked: appLocked } = useLock();
  const [refused, setRefused] = useState(false);
  const [view, setView] = useState<MailSettingsView | null>(null);
  const load = useApi(() => serverApi.mail.get(), [], {
    onSuccess: (v) => {
      setView(v);
      syncForm(v);
    },
    onError: (e) => {
      if (isRefused(e)) setRefused(true);
    },
  });
  const detailsId = useId();
  const currentId = useId();
  const howId = useId();

  const [enabledChoice, setEnabledChoice] = useState(true);
  const [address, setAddress] = useState(DEFAULT_MAIL_ADDRESS);
  const [appPassword, setAppPassword] = useState('');
  const [host, setHost] = useState(DEFAULT_MAIL_HOST);
  const [port, setPort] = useState<number | null>(DEFAULT_MAIL_PORT);
  const [security, setSecurity] = useState<MailSecurity>('tls');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  /** The account password field of the first setup. */
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState<Pending>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
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

  const configured = view ? isMailConfigured(view) : false;
  const mode: Mode = !configured ? 'setup' : editing ? 'edit' : 'locked';

  function syncForm(v: MailSettingsView) {
    // Nothing saved yet: offer to turn it on with the diary's Gmail address.
    const fresh = !v.username && !v.smtpPasswordSet;
    setEnabledChoice(fresh ? true : v.enabled);
    setAddress(v.username || v.fromAddress || DEFAULT_MAIL_ADDRESS);
    setHost(v.host || DEFAULT_MAIL_HOST);
    setPort(v.port || MAIL_SECURITY_PORTS[v.security] || DEFAULT_MAIL_PORT);
    setSecurity(v.security === 'starttls' ? 'starttls' : 'tls');
    setAppPassword('');
    setErrors({});
    setAdvancedOpen(!!v.host && v.host !== DEFAULT_MAIL_HOST);
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      unlockedPassword.current = '';
    };
  }, []);

  // Locking the app (Ctrl+L) locks this card too and forgets any password.
  useEffect(() => {
    if (!appLocked) return;
    unlockedPassword.current = '';
    keepFormOnUnlock.current = false;
    setPassword('');
    setAppPassword('');
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

  /** Shows `found` at the fields, announces the count and focuses the first one (opening "Advanced" when needed). */
  const showErrors = (found: FormErrors): boolean => {
    setErrors(found);
    const invalid = FIELD_ORDER.filter((k) => found[k]);
    if (!invalid.length) return false;
    announce(T.fixErrors(invalid.length), 'assertive');
    if (ADVANCED_FIELDS.includes(invalid[0]) && !advancedOpen) {
      setAdvancedOpen(true);
      focusNext.current = FIELD_IDS[invalid[0]];
    } else {
      document.getElementById(FIELD_IDS[invalid[0]])?.focus();
    }
    return true;
  };

  /** Checks the form; returns the settings to send, or null (errors shown, first invalid field focused). */
  const validate = (requirePassword: boolean): MailSettingsPatch | null => {
    const found: FormErrors = {};
    const addr = address.trim();
    if (!addr) found.address = T.fieldRequired(MT.address);
    else if (emailProblem(addr)) found.address = MT.addressInvalid;
    const server = normaliseMailHost(host);
    if (!isValidMailHost(server)) found.host = MT.hostInvalid;
    const secret = normaliseAppPassword(appPassword, server);
    // The server forgets a saved App Password when the SMTP server changes (it is never sent to another host).
    const keepsSaved = !!view?.smtpPasswordSet && server === view.host;
    if (!secret && !keepsSaved && (enabledChoice || mode === 'setup')) found.appPassword = MT.appPasswordMissing;
    else if (secret && isGmailHost(server) && !isGmailAppPassword(secret)) found.appPassword = MT.appPasswordGmail;
    if (port === null || !Number.isInteger(port) || port < 1 || port > 65535) found.port = MT.portInvalid;
    if (requirePassword && !password) found.password = MT.passwordMissing;
    if (showErrors(found)) return null;
    const patch: MailSettingsPatch = { enabled: enabledChoice, host: server, port: port as number, security, username: addr, fromAddress: addr };
    if (secret) patch.smtpPassword = secret;
    return patch;
  };

  const onSecurityChange = (next: MailSecurity) => {
    setSecurity(next);
    // Move a default port along with the security (465 <-> 587); a custom port stays.
    if (port === null || Object.values(MAIL_SECURITY_PORTS).includes(port)) setPort(MAIL_SECURITY_PORTS[next]);
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
      setUnlockError(MT.passwordMissing);
      return;
    }
    setUnlocking(true);
    setUnlockError(null);
    try {
      if (!(await verifyPassword(pw))) {
        setUnlockError(MT.wrongPassword);
        return;
      }
      if (!alive.current) return;
      unlockedPassword.current = pw;
      if (!keepFormOnUnlock.current && view) syncForm(view);
      keepFormOnUnlock.current = false;
      setOpError(null);
      setTestMessage(null);
      setUnlockOpen(false);
      setEditing(true);
      focusNext.current = MAIL_ADDRESS_ID;
      announce(MT.unlocked, 'polite');
    } catch (e) {
      setUnlockError(errorMessage(e));
    } finally {
      if (alive.current) setUnlocking(false);
    }
  };

  const onCancelEdit = () => {
    if (pendingRef.current === 'save') return;
    unlockedPassword.current = '';
    if (view) syncForm(view);
    setOpError(null);
    setEditing(false);
    focusNext.current = MAIL_CHANGE_BUTTON_ID;
    announce(MT.editCancelled, 'polite');
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!view) return;
    const setup = mode === 'setup';
    const patch = validate(setup);
    if (!patch) return;
    const pw = setup ? password : unlockedPassword.current;
    if (!pw) {
      // Unlocked form without a verified password (it was wrong on the last Save): ask again.
      openUnlock(true);
      return;
    }
    if (!begin('save')) return;
    const wasEnabled = view.enabled;
    try {
      const saved = await serverApi.mail.put({ ...patch, password: pw });
      if (!alive.current) return;
      setView(saved);
      syncForm(saved);
      setPassword('');
      unlockedPassword.current = '';
      setEditing(false);
      setTestMessage(null);
      const nowLocked = isMailConfigured(saved);
      if (nowLocked) focusNext.current = MAIL_CHANGE_BUTTON_ID;
      let message: string;
      if (saved.enabled && !wasEnabled) message = MT.enabled;
      else if (!saved.enabled && wasEnabled) message = MT.disabled;
      else message = nowLocked ? MT.savedLocked : MT.saved;
      announce(message, 'polite');
    } catch (e) {
      if (errorCode(e) === 'WRONG_PASSWORD') {
        if (setup) {
          setErrors({ password: MT.wrongPassword });
          announce(MT.wrongPassword, 'assertive');
          document.getElementById(MAIL_PASSWORD_ID)?.focus();
        } else {
          // The password changed since the form was unlocked: ask again, keep the edits.
          unlockedPassword.current = '';
          openUnlock(true, MT.wrongPassword);
        }
      } else {
        const field = formFieldOf(errorField(e));
        const message = errorMessage(e);
        if (field) {
          showErrors({ [field]: message });
        } else {
          setOpError(message);
          announce(message, 'assertive');
        }
      }
    } finally {
      end();
    }
  };

  const onTest = async () => {
    if (!begin('test')) return;
    setTestMessage(null);
    try {
      const result = await serverApi.mail.test();
      const sentTo = (result && result.sentTo) || user?.email || '';
      const message = (result && result.message) || MT.testSent(sentTo);
      setTestMessage(message);
      announce(message, 'polite');
    } catch (e) {
      const message = MT.testFailed(errorMessage(e));
      setOpError(message);
      announce(message, 'assertive');
    } finally {
      end();
    }
  };

  if (refused) return null;
  if (!view) {
    // Nothing until the server has answered (no flash for accounts it will refuse).
    if (!load.error) return null;
    return (
      <Card title={MT.title} className="mail-settings">
        <div className="stack">
          <p>{MT.intro}</p>
          <Alert kind="error">{load.error}</Alert>
        </div>
      </Card>
    );
  }

  const ownEmail = user?.email?.trim() ?? '';
  const summary: DefinitionItem[] = [
    { term: MT.summaryState, value: view.enabled ? MT.summaryOn : MT.summaryOff },
    { term: MT.summaryAddress, value: <span dir="ltr">{view.fromAddress || view.username}</span> },
    { term: MT.summaryAppPassword, value: MT.summaryAppPasswordSaved },
    { term: MT.summaryServer, value: <span dir="ltr">{MT.serverValue(view.host, view.port, view.security)}</span> },
  ];

  return (
    <Card title={MT.title} className="mail-settings">
      <div className="stack">
        <p>{MT.intro}</p>
        <p className="mail-settings__owner">{view.hasOwner ? MT.ownerNote : MT.setupOwnerNote}</p>
        {opError && <Alert kind="error" role="none">{opError}</Alert>}
        {testMessage && (
          // Announced through the live region; the box itself stays silent.
          <Alert kind="success" role="none">
            {testMessage}
          </Alert>
        )}

        {mode === 'locked' && (
          <section aria-labelledby={currentId} className="stack-sm">
            <h3 id={currentId}>{MT.currentTitle}</h3>
            <DefinitionList aria-label={MT.currentTitle} items={summary} />
            {view.enabled && !view.ready && <Alert kind="warning">{MT.notReady}</Alert>}
            <p className="text-muted">{MT.lockedHint}</p>
            {view.enabled && view.ready && <p className="text-muted">{ownEmail ? MT.testHint(ownEmail) : MT.testNoEmail}</p>}
            <div className="cluster">
              {view.enabled && view.ready && (
                <Button variant="secondary" loading={pending === 'test'} onClick={() => void onTest()}>
                  {MT.test}
                </Button>
              )}
              <Button id={MAIL_CHANGE_BUTTON_ID} variant="secondary" aria-haspopup="dialog" onClick={() => openUnlock(false)}>
                {MT.change}
              </Button>
            </div>
          </section>
        )}

        {mode !== 'locked' && (
          <form className="form stack-sm" onSubmit={(e) => void onSave(e)} noValidate aria-labelledby={detailsId}>
            <h3 id={detailsId}>{MT.detailsTitle}</h3>
            <Checkbox id={MAIL_ENABLED_ID} label={MT.switchLabel} hint={MT.switchHint} checked={enabledChoice} onChange={setEnabledChoice} />
            <Field id={MAIL_ADDRESS_ID} label={MT.address} hint={MT.addressHint} error={errors.address ?? null} required>
              {(a11y) => (
                <TextInput
                  {...a11y}
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  value={address}
                  placeholder={DEFAULT_MAIL_ADDRESS}
                  onChange={(e) => {
                    setAddress(e.currentTarget.value);
                    if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
                  }}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              )}
            </Field>
            <Field
              id={MAIL_APP_PASSWORD_ID}
              label={MT.appPassword}
              hint={
                view.smtpPasswordSet ? (
                  <span className="mail-settings__saved">
                    <span aria-hidden="true">✓ </span>
                    {MT.appPasswordSaved}
                  </span>
                ) : (
                  MT.appPasswordHint
                )
              }
              error={errors.appPassword ?? null}
              required={!view.smtpPasswordSet}
            >
              {(a11y) => (
                <PasswordInput
                  {...a11y}
                  dir="ltr"
                  value={appPassword}
                  // Not this site's password: keep password managers from filling in or saving it.
                  autoComplete="off"
                  onChange={(e) => {
                    setAppPassword(e.currentTarget.value);
                    if (errors.appPassword) setErrors((prev) => ({ ...prev, appPassword: undefined }));
                  }}
                />
              )}
            </Field>
            <details className="mail-settings__advanced" open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
              <summary>{MT.advanced}</summary>
              <div className="stack-sm">
                <Field id={MAIL_HOST_ID} label={MT.host} hint={MT.hostHint} error={errors.host ?? null} required>
                  {(a11y) => (
                    <TextInput
                      {...a11y}
                      dir="ltr"
                      inputMode="url"
                      value={host}
                      placeholder={DEFAULT_MAIL_HOST}
                      onChange={(e) => {
                        setHost(e.currentTarget.value);
                        if (errors.host) setErrors((prev) => ({ ...prev, host: undefined }));
                      }}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  )}
                </Field>
                <Select<MailSecurity>
                  id={MAIL_SECURITY_ID}
                  label={MT.security}
                  value={security}
                  onChange={onSecurityChange}
                  options={[
                    { value: 'tls', label: MT.securityLabel('tls') },
                    { value: 'starttls', label: MT.securityLabel('starttls') },
                  ]}
                />
                <NumberInput
                  id={MAIL_PORT_ID}
                  label={MT.port}
                  hint={MT.portHint}
                  value={port}
                  onChange={setPort}
                  min={1}
                  max={65535}
                  step={1}
                  inputMode="numeric"
                  error={errors.port ?? null}
                  required
                />
              </div>
            </details>
            {mode === 'setup' && (
              <Field id={MAIL_PASSWORD_ID} label={MT.password} hint={MT.passwordHint} error={errors.password ?? null} required>
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

        <section aria-labelledby={howId} className="stack-sm">
          <h3 id={howId}>{MT.instructionsTitle}</h3>
          <p>{MT.whyAppPassword}</p>
          <ol>
            {MT.instructions().map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <p className="mail-settings__privacy">{MT.privacyNote}</p>
      </div>
      <ConfirmDialog
        open={unlockOpen}
        title={MT.unlockTitle}
        message={MT.unlockMessage}
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
 * The "E-mail for password reset" card, or nothing when the page is not opened
 * on the computer itself (phone on the LAN, or the diary opened over the
 * internet), or when another account on this computer owns the mail settings
 * (`isMailOwner: false`, see useOwnerCard - or a 403 from an older server).
 */
export function MailSection() {
  const allowed = useOwnerCard('isMailOwner');
  if (!allowed) return null;
  return <MailCard />;
}
