/**
 * "Change password" dialog: old password, new password, confirmation.
 * Client validation mirrors the server (passwordProblem + match); the number
 * of errors is announced inside the dialog (the global live region is inert
 * while a modal is open) and the first invalid field receives focus.
 * A wrong old password (401 WRONG_PASSWORD) is shown at the old-password
 * field without ending the session (withPasswordCheck restores the token).
 */
import { useEffect, useId, useState, type FormEvent } from 'react';
import { passwordProblem } from '@shared/constants';
import { getCurrentLocale } from '@/i18n/runtime';
import { auth as authApi } from '@/api';
import { Dialog } from '@/components/a11y/Dialog';
import { LiveRegion } from '@/components/a11y/LiveRegion';
import { Alert } from '@/components/ui/Alert';
import { NeedsConnectionHint } from '@/components/sync/NeedsConnection';
import { useOfflineNow } from '@/components/sync/hooks';
import { drainBeforeOnlineWrite } from '@/components/sync/syncGate';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { offline } from '@/offline';
import { errorCode, errorField, errorMessage } from '@/utils/errors';
import { ST } from './texts';

export type ChangePasswordField = 'oldPassword' | 'newPassword' | 'confirmPassword';
export type ChangePasswordValues = Record<ChangePasswordField, string>;
export type ChangePasswordErrors = Partial<Record<ChangePasswordField, string>>;

const FIELD_ORDER: ChangePasswordField[] = ['oldPassword', 'newPassword', 'confirmPassword'];
const EMPTY: ChangePasswordValues = { oldPassword: '', newPassword: '', confirmPassword: '' };

/** Field label in the current UI language. */
function labelOf(name: ChangePasswordField): string {
  switch (name) {
    case 'oldPassword':
      return ST.oldPassword;
    case 'newPassword':
      return ST.newPassword;
    case 'confirmPassword':
      return ST.confirmNewPassword;
  }
}

/** Pure validation (exported for tests). */
export function validateChangePassword(values: ChangePasswordValues): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};
  if (!values.oldPassword) errors.oldPassword = T.fieldRequired(ST.oldPassword);
  if (!values.newPassword) {
    errors.newPassword = T.fieldRequired(ST.newPassword);
  } else {
    const problem = passwordProblem(values.newPassword, getCurrentLocale());
    if (problem) errors.newPassword = problem;
  }
  if (!values.confirmPassword) {
    errors.confirmPassword = T.fieldRequired(ST.confirmNewPassword);
  } else if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = T.passwordsMismatch;
  }
  return errors;
}

export interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after the password was changed (every other device was signed out: the device list is stale). */
  onChanged?: () => void;
}

export function ChangePasswordDialog({ open, onClose, onChanged }: ChangePasswordDialogProps) {
  const { withPasswordCheck } = useAuth();
  const toast = useToast();
  const { announce } = useAnnouncer();
  const base = useId();
  const dialogId = `change-password-${base}`;
  const fieldId = (name: ChangePasswordField) => `${dialogId}-${name}`;

  const [values, setValues] = useState<ChangePasswordValues>(EMPTY);
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Fresh form on every opening.
  useEffect(() => {
    if (open) {
      setValues(EMPTY);
      setErrors({});
      setServerError(null);
      setLiveMessage('');
      setBusy(false);
    }
  }, [open]);

  const setValue = (name: ChangePasswordField, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const focusFirstInvalid = (errs: ChangePasswordErrors) => {
    const first = FIELD_ORDER.find((name) => errs[name]);
    if (first) document.getElementById(fieldId(first))?.focus();
  };

  const close = () => {
    if (busy) return;
    onClose();
  };

  // Needs the server (offline mode, section 6.2); goes after what waits on this device.
  const offlineNow = useOfflineNow();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || offlineNow) return;
    setServerError(null);
    const next = validateChangePassword(values);
    setErrors(next);
    const count = FIELD_ORDER.filter((name) => next[name]).length;
    if (count > 0) {
      setLiveMessage(T.fixErrors(count));
      focusFirstInvalid(next);
      return;
    }
    setBusy(true);
    try {
      const left = (m: string) => {
        setServerError(m);
        setLiveMessage(m);
      };
      if (!(await drainBeforeOnlineWrite({ onDraining: (m) => setLiveMessage(m), onLeft: left }))) return;
      await withPasswordCheck(() =>
        authApi.changePassword({
          oldPassword: values.oldPassword,
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword,
        }),
      );
      // The NEW password is the one the server accepts from now on: the offline unlock follows it
      // (OFFLINE-DESIGN section 13, 2026-11-08). No-op when the offline engine does not run.
      void offline.refreshPasswordWrap(values.newPassword).catch(() => undefined);
      onClose();
      onChanged?.();
      announce(ST.passwordChanged, 'polite');
      toast.success(ST.passwordChanged, { announced: true });
    } catch (err) {
      const code = errorCode(err);
      const message = errorMessage(err);
      let field = errorField(err) as ChangePasswordField | null;
      if (code === 'WRONG_PASSWORD') field = 'oldPassword';
      if (!field && code === 'WEAK_PASSWORD') field = 'newPassword';
      if (field && FIELD_ORDER.includes(field)) {
        const errs: ChangePasswordErrors = { [field]: code === 'WRONG_PASSWORD' ? ST.wrongOldPassword : message };
        setErrors(errs);
        setLiveMessage(errs[field] ?? message);
        focusFirstInvalid(errs);
      } else {
        setServerError(message);
        setLiveMessage(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const passwordField = (name: ChangePasswordField, autoComplete: 'current-password' | 'new-password', hint?: string) => (
    <Field id={fieldId(name)} label={labelOf(name)} error={errors[name]} hint={hint} required>
      {(a11y) => (
        <PasswordInput
          {...a11y}
          name={name}
          autoComplete={autoComplete}
          value={values[name]}
          onChange={(e) => setValue(name, e.currentTarget.value)}
        />
      )}
    </Field>
  );

  return (
    <Dialog open={open} onClose={close} title={ST.changePassword} size="sm" id={dialogId} describedBy={`${dialogId}-desc`}>
      <p id={`${dialogId}-desc`} className="text-muted">
        {ST.passwordChangeHint}
      </p>
      {serverError && <Alert kind="error" role="none">{serverError}</Alert>}
      <form className="form" onSubmit={onSubmit} noValidate>
        {passwordField('oldPassword', 'current-password')}
        {passwordField('newPassword', 'new-password', ST.newPasswordHint)}
        {passwordField('confirmPassword', 'new-password')}
        {/* Same order as every dialog (ConfirmDialog): Cancel, then the action. */}
        <div className="form__actions">
          <Button variant="secondary" onClick={close}>
            {T.cancel}
          </Button>
          <Button type="submit" loading={busy} disabled={offlineNow} aria-describedby={offlineNow ? `${dialogId}-needs-connection` : undefined}>
            {T.confirm}
          </Button>
        </div>
        <NeedsConnectionHint id={`${dialogId}-needs-connection`} />
      </form>
      <LiveRegion politeness="assertive" message={liveMessage} />
    </Dialog>
  );
}
