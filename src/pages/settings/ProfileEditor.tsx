/**
 * Editing of the account details (first name, last name, e-mail) through
 * PUT /api/auth/profile:
 *  - <ProfileForm>: the inline form revealed by "Edit details", prefilled with
 *    the current values; only the fields that changed are sent.
 *  - <SetEmailDialog>: one e-mail field for an account registered before the
 *    field existed ("Not set" + "Set" in the account card).
 *
 * The e-mail address receives the password-reset links, so a new address needs
 * the account password ("currentPassword"; the server refuses the change
 * without it). The password field appears as soon as the address differs.
 *
 * Client validation mirrors the registration form; server validation errors
 * (VALIDATION with a field, the 409 for an e-mail that is already registered,
 * a wrong password) land on the matching field, anything else in an Alert. The parent closes the
 * form / dialog, refreshes the user (header greeting) and announces the outcome.
 */
import { useEffect, useId, useState, type FormEvent } from 'react';
import type { UserProfile } from '@shared/types';
import { auth as authApi, isApiClientError } from '@/api';
import { Dialog } from '@/components/a11y/Dialog';
import { LiveRegion } from '@/components/a11y/LiveRegion';
import { Alert } from '@/components/ui/Alert';
import { NeedsConnectionHint } from '@/components/sync/NeedsConnection';
import { useOfflineNow } from '@/components/sync/hooks';
import { drainBeforeOnlineWrite } from '@/components/sync/syncGate';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TextInput } from '@/components/ui/TextInput';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { emailProblem } from '@/pages/RegisterPage';
import { errorField, errorMessage } from '@/utils/errors';
import { ST } from './texts';

export type ProfileField = 'firstName' | 'lastName' | 'email';
export type ProfileValues = Record<ProfileField, string>;
export type ProfileErrors = Partial<Record<ProfileField, string>>;

/** Field order = focus order for "first invalid field". */
export const PROFILE_FIELDS: ProfileField[] = ['firstName', 'lastName', 'email'];

/** Field label in the current UI language. */
function labelOf(name: ProfileField): string {
  switch (name) {
    case 'firstName':
      return T.firstName;
    case 'lastName':
      return T.lastName;
    case 'email':
      return T.email;
  }
}

/**
 * Problem with an e-mail value, or null: required when `required`, otherwise
 * only the shape of a non-empty value is checked (exported for tests).
 */
export function emailFieldProblem(email: string, required: boolean): string | null {
  const trimmed = email.trim();
  if (!trimmed) return required ? T.fieldRequired(T.email) : null;
  return emailProblem(trimmed);
}

/** Pure validation of the inline form (exported for tests). An existing e-mail address cannot be cleared. */
export function validateProfile(values: ProfileValues, current: Pick<UserProfile, 'email'>): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!values.firstName.trim()) errors.firstName = T.fieldRequired(T.firstName);
  if (!values.lastName.trim()) errors.lastName = T.fieldRequired(T.lastName);
  const email = emailFieldProblem(values.email, Boolean(current.email));
  if (email) errors.email = email;
  return errors;
}

/** The trimmed values that differ from the profile - the request body (exported for tests). */
export function profileChanges(user: UserProfile, values: ProfileValues): Partial<ProfileValues> {
  const changes: Partial<ProfileValues> = {};
  for (const name of PROFILE_FIELDS) {
    const value = values[name].trim();
    if (value !== (user[name] ?? '')) changes[name] = value;
  }
  return changes;
}

/** Name of the account-password field that confirms a new e-mail address (the server's field name). */
export const CURRENT_PASSWORD_FIELD = 'currentPassword';

/** True when `email` is a different address than the account's (a change of letter case only is not). */
export function emailChanges(email: string, current: string | undefined): boolean {
  const next = email.trim().toLowerCase();
  return next !== '' && next !== (current ?? '').trim().toLowerCase();
}

/** Maps a server error to the field it belongs to (null for a general error) and a message in the UI language. */
export function profileServerError(err: unknown): { field: ProfileField | typeof CURRENT_PASSWORD_FIELD | null; message: string } {
  const field = errorField(err);
  if (field === 'email' && isApiClientError(err) && err.status === 409) return { field: 'email', message: T.emailTaken };
  if (field && (PROFILE_FIELDS as string[]).includes(field)) return { field: field as ProfileField, message: errorMessage(err) };
  if (field === CURRENT_PASSWORD_FIELD) return { field: CURRENT_PASSWORD_FIELD, message: errorMessage(err) };
  return { field: null, message: errorMessage(err) };
}

/** The account-password field shown when the e-mail address changes. */
function EmailPasswordField({ id, value, error, onChange }: { id: string; value: string; error?: string | null; onChange: (value: string) => void }) {
  return (
    <Field id={id} label={ST.emailPassword} error={error} hint={ST.emailPasswordHint} required>
      {(a11y) => (
        <PasswordInput {...a11y} name={CURRENT_PASSWORD_FIELD} autoComplete="current-password" value={value} onChange={(e) => onChange(e.currentTarget.value)} />
      )}
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Inline form
// ---------------------------------------------------------------------------

export interface ProfileFormProps {
  user: UserProfile;
  /** Id of the <form> (the "Edit details" button points at it with aria-controls). */
  id: string;
  onCancel: () => void;
  /** Called after a successful save; `changed` is false when nothing differed and no request was made. */
  onSaved: (changed: boolean) => void | Promise<void>;
}

export function ProfileForm({ user, id, onCancel, onSaved }: ProfileFormProps) {
  const { announce } = useAnnouncer();
  const fieldId = (name: ProfileField) => `${id}-${name}`;
  const [values, setValues] = useState<ProfileValues>({ firstName: user.firstName, lastName: user.lastName, email: user.email ?? '' });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordId = `${id}-${CURRENT_PASSWORD_FIELD}`;
  const needsPassword = emailChanges(values.email, user.email);
  // Needs the server (offline mode, section 6.2); goes after what waits on this device.
  const offlineNow = useOfflineNow();

  // The form is revealed by a button: continue in its first field.
  useEffect(() => {
    document.getElementById(fieldId('firstName'))?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setValue = (name: ProfileField, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const focusFirstInvalid = (errs: ProfileErrors) => {
    const first = PROFILE_FIELDS.find((name) => errs[name]);
    if (first) document.getElementById(fieldId(first))?.focus();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || offlineNow) return;
    setServerError(null);
    const next = validateProfile(values, user);
    setErrors(next);
    const missingPassword = needsPassword && !password ? T.fieldRequired(ST.emailPassword) : null;
    setPasswordError(missingPassword);
    const count = PROFILE_FIELDS.filter((name) => next[name]).length + (missingPassword ? 1 : 0);
    if (count > 0) {
      announce(T.fixErrors(count), 'assertive');
      if (PROFILE_FIELDS.some((name) => next[name])) focusFirstInvalid(next);
      else document.getElementById(passwordId)?.focus();
      return;
    }
    const changes = profileChanges(user, values);
    if (Object.keys(changes).length === 0) {
      await onSaved(false);
      return;
    }
    setBusy(true);
    try {
      const left = (m: string) => {
        setServerError(m);
        announce(m, 'assertive');
      };
      if (!(await drainBeforeOnlineWrite({ onDraining: (m) => announce(m, 'polite'), onLeft: left }))) return;
      await authApi.updateProfile(needsPassword ? { ...changes, currentPassword: password } : changes);
      await onSaved(true);
    } catch (err) {
      const { field, message } = profileServerError(err);
      if (field === CURRENT_PASSWORD_FIELD) {
        setPasswordError(message);
        document.getElementById(passwordId)?.focus();
      } else if (field) {
        const errs: ProfileErrors = { [field]: message };
        setErrors(errs);
        focusFirstInvalid(errs);
      } else {
        setServerError(message);
      }
      announce(message, 'assertive');
    } finally {
      setBusy(false);
    }
  };

  const textField = (name: ProfileField, autoComplete: string, extra: { type?: 'email'; dir?: 'ltr'; hint?: string; required: boolean }) => (
    <Field id={fieldId(name)} label={labelOf(name)} error={errors[name]} hint={extra.hint} required={extra.required}>
      {(a11y) => (
        <TextInput
          {...a11y}
          name={name}
          type={extra.type ?? 'text'}
          dir={extra.dir}
          inputMode={extra.type === 'email' ? 'email' : undefined}
          autoComplete={autoComplete}
          value={values[name]}
          onChange={(e) => setValue(name, e.currentTarget.value)}
        />
      )}
    </Field>
  );

  return (
    <form id={id} className="form" aria-label={ST.editDetails} onSubmit={(e) => void onSubmit(e)} noValidate>
      <p className="text-muted text-small">{ST.editDetailsHint}</p>
      {serverError && <Alert kind="error" role="none">{serverError}</Alert>}
      <div className="settings-grid">
        {textField('firstName', 'given-name', { required: true })}
        {textField('lastName', 'family-name', { required: true })}
      </div>
      {textField('email', 'email', { type: 'email', dir: 'ltr', hint: T.emailHint, required: Boolean(user.email) })}
      {needsPassword && (
        <EmailPasswordField
          id={passwordId}
          value={password}
          error={passwordError}
          onChange={(value) => {
            setPassword(value);
            if (passwordError) setPasswordError(null);
          }}
        />
      )}
      <div className="form__actions">
        <Button type="submit" loading={busy} disabled={offlineNow} aria-describedby={offlineNow ? `${id}-needs-connection` : undefined}>
          {T.confirm}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {T.cancel}
        </Button>
      </div>
      <NeedsConnectionHint id={`${id}-needs-connection`} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Set-e-mail dialog
// ---------------------------------------------------------------------------

export interface SetEmailDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after the address was saved; the parent closes the dialog, refreshes the user and announces. */
  onSaved: () => void | Promise<void>;
}

export function SetEmailDialog({ open, onClose, onSaved }: SetEmailDialogProps) {
  const base = useId();
  const dialogId = `set-email-${base}`;
  const fieldId = `${dialogId}-email`;
  const passwordId = `${dialogId}-${CURRENT_PASSWORD_FIELD}`;
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  // Needs the server (offline mode, section 6.2); goes after what waits on this device.
  const offlineNow = useOfflineNow();
  const [busy, setBusy] = useState(false);

  // Fresh field on every opening.
  useEffect(() => {
    if (open) {
      setValue('');
      setError(null);
      setPassword('');
      setPasswordError(null);
      setServerError(null);
      setLiveMessage('');
      setBusy(false);
    }
  }, [open]);

  const close = () => {
    if (busy) return;
    onClose();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setServerError(null);
    const problem = emailFieldProblem(value, true);
    const missingPassword = password ? null : T.fieldRequired(ST.emailPassword);
    setError(problem);
    setPasswordError(missingPassword);
    if (problem || missingPassword) {
      setLiveMessage(problem && missingPassword ? T.fixErrors(2) : (problem ?? missingPassword ?? ''));
      document.getElementById(problem ? fieldId : passwordId)?.focus();
      return;
    }
    if (offlineNow) return;
    setBusy(true);
    try {
      const left = (m: string) => {
        setServerError(m);
        setLiveMessage(m);
      };
      if (!(await drainBeforeOnlineWrite({ onDraining: (m) => setLiveMessage(m), onLeft: left }))) return;
      await authApi.updateProfile({ email: value.trim(), currentPassword: password });
      await onSaved();
    } catch (err) {
      const { field, message } = profileServerError(err);
      if (field === CURRENT_PASSWORD_FIELD) {
        setPasswordError(message);
        document.getElementById(passwordId)?.focus();
      } else if (field === 'email') {
        setError(message);
        document.getElementById(fieldId)?.focus();
      } else {
        setServerError(message);
      }
      setLiveMessage(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} title={ST.setEmailTitle} size="sm" id={dialogId} describedBy={`${dialogId}-desc`}>
      <p id={`${dialogId}-desc`} className="text-muted">
        {T.emailHint}
      </p>
      {serverError && <Alert kind="error" role="none">{serverError}</Alert>}
      <form className="form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <Field id={fieldId} label={T.email} error={error} required>
          {(a11y) => (
            <TextInput
              {...a11y}
              name="email"
              type="email"
              dir="ltr"
              inputMode="email"
              autoComplete="email"
              value={value}
              onChange={(e) => {
                setValue(e.currentTarget.value);
                if (error) setError(null);
              }}
            />
          )}
        </Field>
        <EmailPasswordField
          id={passwordId}
          value={password}
          error={passwordError}
          onChange={(next) => {
            setPassword(next);
            if (passwordError) setPasswordError(null);
          }}
        />
        {/* Same order as every dialog (ConfirmDialog): Cancel, then the action. */}
        <div className="form__actions">
          <Button variant="secondary" onClick={close}>
            {T.cancel}
          </Button>
          <Button type="submit" loading={busy} disabled={offlineNow} aria-describedby={offlineNow ? `${fieldId}-needs-connection` : undefined}>
            {T.confirm}
          </Button>
        </div>
        <NeedsConnectionHint id={`${fieldId}-needs-connection`} />
      </form>
      <LiveRegion politeness="assertive" message={liveMessage} />
    </Dialog>
  );
}
