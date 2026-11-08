/**
 * Confirmation dialog ("Delete the entry?"). With `requirePassword` it shows a
 * password field and passes the value to `onConfirm(password)` - used for
 * destructive account actions. Focus returns to the opener when closed.
 */
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Dialog } from '@/components/a11y/Dialog';
import { LiveRegion } from '@/components/a11y/LiveRegion';
import { T } from '@/constants/texts';
import { Button } from './Button';
import { Field } from './Field';
import { PasswordInput } from './PasswordInput';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Question or explanation shown in the body. */
  message: ReactNode;
  /** Default T.confirm ("Confirm"). */
  confirmLabel?: string;
  /** Default T.cancel ("Cancel"). */
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  /** Called with the password when `requirePassword`, otherwise with undefined. */
  onConfirm: (password?: string) => void | Promise<void>;
  onCancel: () => void;
  /** Ask for the account password before confirming. */
  requirePassword?: boolean;
  /** Shows a spinner on the confirm button while the action runs. */
  loading?: boolean;
  /** Error to show (e.g. wrong password); announced assertively. */
  error?: string | null;
  id?: string;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = T.confirm,
  cancelLabel = T.cancel,
  danger = false,
  onConfirm,
  onCancel,
  requirePassword = false,
  loading = false,
  error,
  id,
}: ConfirmDialogProps) {
  const base = useId();
  const dialogId = id ?? `confirm-${base}`;
  const messageId = `${dialogId}-message`;
  const passwordId = `${dialogId}-password`;
  const [password, setPassword] = useState('');

  // Start every opening with an empty password.
  useEffect(() => {
    if (open) setPassword('');
  }, [open]);

  const submit = () => {
    if (loading) return;
    void onConfirm(requirePassword ? password : undefined);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      id={dialogId}
      describedBy={messageId}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={submit} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div id={messageId}>{typeof message === 'string' ? <p>{message}</p> : message}</div>
      {requirePassword && (
        <form onSubmit={onSubmit} className="form" noValidate>
          <Field id={passwordId} label={T.password} error={error ?? null} required>
            {(a11y) => (
              <PasswordInput
                {...a11y}
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete="current-password"
                data-autofocus
              />
            )}
          </Field>
          {/* Keeps Enter working inside the field. */}
          <button type="submit" className="visually-hidden" tabIndex={-1} aria-hidden="true">
            {confirmLabel}
          </button>
        </form>
      )}
      {!requirePassword && error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      {requirePassword && <LiveRegion politeness="assertive" message={error ?? ''} />}
    </Dialog>
  );
}
