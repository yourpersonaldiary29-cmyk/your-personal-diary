/**
 * "Choose a new password" page (/reset-password, public - it works over the
 * remote HTTPS address too). Two ways in, both from the password-reset e-mail:
 *
 *  - the link `<base>/#/reset-password?token=<token>`: the token is moved out of
 *    the address bar at once (into the history entry's state, so it is not left
 *    on screen or in the visible URL but survives a reload), and only the new
 *    password (twice) is asked for;
 *  - the 6-digit code: e-mail address + code + the new password twice. Offered
 *    when there is no token, and from the link form ("Use the code from the
 *    e-mail instead") for a link that is used up or expired.
 *
 * POST /api/auth/reset-password. Client validation mirrors the server
 * (passwordProblem + match, 6 digits, e-mail shape); errors sit at their fields
 * (aria-invalid + aria-describedby), the count is announced and the first
 * invalid field is focused. A wrong / expired / used token or code (400
 * 'server.reset.invalid') is shown in an Alert as the server phrased it, with
 * "Request a new link" below.
 *
 * On success the server has kept the diary (re-encrypted under the new
 * password) and signed the account out everywhere: a toast says so, this device
 * drops its own session too when it had one, and the visitor lands on /login
 * (or on the home page when another account is signed in here - it stays so).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PASSWORD_MIN_LENGTH, passwordProblem } from '@shared/constants';
import type { ResetPasswordRequest, ResetPasswordResponse, UserProfile } from '@shared/types';
import { auth as authApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TextInput } from '@/components/ui/TextInput';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getCurrentLocale } from '@/i18n/runtime';
import { errorCode, errorField, errorMessage } from '@/utils/errors';
import { emailFromState } from './ForgotPasswordPage';
import { emailProblem } from './RegisterPage';

export type ResetField = 'email' | 'code' | 'newPassword' | 'confirmPassword';
export type ResetValues = Record<ResetField, string>;
export type ResetErrors = Partial<Record<ResetField, string>>;
export type ResetMode = 'link' | 'code';

/** Field order = focus order for "first invalid field". */
const FIELD_ORDER: ResetField[] = ['email', 'code', 'newPassword', 'confirmPassword'];
/** The fields each mode shows. */
const MODE_FIELDS: Record<ResetMode, ResetField[]> = {
  link: ['newPassword', 'confirmPassword'],
  code: ['email', 'code', 'newPassword', 'confirmPassword'],
};

export function resetFieldId(name: ResetField): string {
  return `reset-${name}`;
}

/** Field labels, read in the current language when used. */
function labelOf(name: ResetField): string {
  switch (name) {
    case 'email':
      return T.forgotEmail;
    case 'code':
      return T.resetCode;
    case 'newPassword':
      return T.resetNewPassword;
    case 'confirmPassword':
      return T.resetConfirmPassword;
  }
}

/**
 * The code as the server expects it: ASCII digits only. Spaces and hyphens are
 * dropped, Arabic-Indic and Persian digits become 0-9.
 */
export function normaliseResetCode(raw: string): string {
  return raw
    .replace(/[\s-]/g, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Pure validation of the fields `mode` shows (exported for tests). */
export function validateReset(values: ResetValues, mode: ResetMode): ResetErrors {
  const errors: ResetErrors = {};
  const fields = MODE_FIELDS[mode];
  if (fields.includes('email')) {
    const email = values.email.trim();
    const problem = email ? emailProblem(email) : T.fieldRequired(labelOf('email'));
    if (problem) errors.email = problem;
  }
  if (fields.includes('code')) {
    const code = normaliseResetCode(values.code);
    if (!code) errors.code = T.fieldRequired(labelOf('code'));
    else if (!/^\d{6}$/.test(code)) errors.code = T.resetCodeInvalid;
  }
  if (!values.newPassword) {
    errors.newPassword = T.fieldRequired(labelOf('newPassword'));
  } else {
    const problem = passwordProblem(values.newPassword, getCurrentLocale());
    if (problem) errors.newPassword = problem;
  }
  if (!values.confirmPassword) errors.confirmPassword = T.fieldRequired(labelOf('confirmPassword'));
  else if (values.confirmPassword !== values.newPassword) errors.confirmPassword = T.passwordsMismatch;
  return errors;
}

/** The link's token kept in the history entry's state (see the file comment). */
function tokenFromState(state: unknown): string {
  if (state && typeof state === 'object') {
    const token = (state as { resetToken?: unknown }).resetToken;
    if (typeof token === 'string') return token;
  }
  return '';
}

/**
 * True when the signed-in `user` is the account whose password was just reset: by the username
 * the server reports, or - from an older server - by the e-mail address typed into the code form.
 * Exported for tests.
 */
export function isResetAccount(user: Pick<UserProfile, 'username' | 'email'>, res: Partial<ResetPasswordResponse> | undefined, typedEmail: string): boolean {
  if (res?.username) return res.username.toLowerCase() === user.username.toLowerCase();
  const email = typedEmail.trim().toLowerCase();
  return !!email && email === (user.email ?? '').trim().toLowerCase();
}

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status, user, logout } = useAuth();
  const toast = useToast();
  const { announce } = useAnnouncer();

  const urlToken = (searchParams.get('token') ?? '').trim();
  const token = urlToken || tokenFromState(location.state);

  const [mode, setMode] = useState<ResetMode>(token ? 'link' : 'code');
  const [values, setValues] = useState<ResetValues>(() => ({
    email: emailFromState(location.state),
    code: '',
    newPassword: '',
    confirmPassword: '',
  }));
  const [errors, setErrors] = useState<ResetErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Where focus goes after the next render (a field that appears with the code form). */
  const focusNext = useRef<string | null>(null);

  // Move the token out of the visible address (into this history entry's state).
  useEffect(() => {
    if (!urlToken) return;
    const state = location.state && typeof location.state === 'object' ? (location.state as Record<string, unknown>) : {};
    navigate({ pathname: location.pathname, search: '', hash: location.hash }, { replace: true, state: { ...state, resetToken: urlToken } });
  }, [urlToken, location.pathname, location.hash, location.state, navigate]);

  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    document.getElementById(id)?.focus();
  });

  const setValue = (name: ResetField, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const focusFirstInvalid = (errs: ResetErrors) => {
    const first = FIELD_ORDER.find((name) => errs[name]);
    if (first) document.getElementById(resetFieldId(first))?.focus();
  };

  const switchToCode = () => {
    setMode('code');
    setErrors({});
    setServerError(null);
    focusNext.current = resetFieldId(values.email.trim() ? 'code' : 'email');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setServerError(null);
    const next = validateReset(values, mode);
    setErrors(next);
    const count = FIELD_ORDER.filter((name) => next[name]).length;
    if (count > 0) {
      announce(T.fixErrors(count), 'assertive');
      focusFirstInvalid(next);
      return;
    }
    const body: ResetPasswordRequest =
      mode === 'link'
        ? { token, newPassword: values.newPassword, confirmPassword: values.confirmPassword }
        : {
            email: values.email.trim(),
            code: normaliseResetCode(values.code),
            newPassword: values.newPassword,
            confirmPassword: values.confirmPassword,
          };
    setBusy(true);
    try {
      const res = await authApi.resetPassword(body);
      const message = (res && typeof res.message === 'string' && res.message) || T.resetDone;
      toast.success(message);
      // The server signed the reset account out everywhere: drop this device's session only when it
      // belongs to THAT account - another account signed in here stays signed in.
      const signedOut = status === 'authenticated' && !!user && isResetAccount(user, res, mode === 'code' ? values.email : '');
      if (signedOut) await logout();
      if (status === 'authenticated' && user && !signedOut) {
        // Another account stays signed in here: the login page would only bounce it to the home
        // page (announcing "Log in" first), so go there directly.
        navigate(PATHS.home, { replace: true });
      } else {
        // The login page starts with the account that was just reset.
        navigate(PATHS.login, { replace: true, state: res?.username ? { username: res.username } : undefined });
      }
    } catch (err) {
      let field = errorField(err) as ResetField | null;
      if (!field && errorCode(err) === 'WEAK_PASSWORD') field = 'newPassword';
      const message = errorMessage(err);
      if (field && MODE_FIELDS[mode].includes(field)) {
        const errs: ResetErrors = { [field]: message };
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

  const textField = (name: 'email' | 'code') => (
    <Field id={resetFieldId(name)} label={labelOf(name)} error={errors[name]} hint={name === 'code' ? T.resetCodeHint : undefined} required>
      {(a11y) =>
        name === 'email' ? (
          <TextInput
            {...a11y}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            autoCapitalize="off"
            spellCheck={false}
            value={values.email}
            onChange={(e) => setValue('email', e.currentTarget.value)}
          />
        ) : (
          <TextInput
            {...a11y}
            name="code"
            autoComplete="one-time-code"
            inputMode="numeric"
            dir="ltr"
            maxLength={12}
            autoCapitalize="off"
            spellCheck={false}
            value={values.code}
            onChange={(e) => setValue('code', e.currentTarget.value)}
          />
        )
      }
    </Field>
  );

  const passwordField = (name: 'newPassword' | 'confirmPassword') => (
    <Field
      id={resetFieldId(name)}
      label={labelOf(name)}
      error={errors[name]}
      hint={name === 'newPassword' ? T.passwordHint(PASSWORD_MIN_LENGTH) : undefined}
      required
    >
      {(a11y) => (
        <PasswordInput
          {...a11y}
          name={name}
          autoComplete="new-password"
          value={values[name]}
          onChange={(e) => setValue(name, e.currentTarget.value)}
        />
      )}
    </Field>
  );

  const requestEmail = values.email.trim();

  return (
    <div className="auth-card">
      <PageTitle title={T.resetTitle} />
      <Card>
        <div className="stack-sm">
          {serverError && (
            <Alert kind="error" role="none" id="reset-server-error">
              {serverError}
            </Alert>
          )}
          <p>{mode === 'link' ? T.resetIntroLink : T.resetIntroCode}</p>
        </div>
        <form className="form" onSubmit={onSubmit} noValidate aria-describedby={serverError ? 'reset-server-error' : undefined}>
          {mode === 'code' && textField('email')}
          {mode === 'code' && textField('code')}
          {passwordField('newPassword')}
          {passwordField('confirmPassword')}
          <div className="form__actions">
            <Button type="submit" loading={busy} size="lg">
              {T.resetSubmit}
            </Button>
          </div>
        </form>
        <ul className="auth-next">
          {mode === 'link' && (
            <li>
              <Button variant="ghost" onClick={switchToCode}>
                {T.resetUseCode}
              </Button>
            </li>
          )}
          <li>
            <Link to={PATHS.forgotPassword} state={requestEmail ? { email: requestEmail } : undefined}>
              {T.resetRequestNew}
            </Link>
          </li>
          <li>
            <Link to={PATHS.login}>{T.backToLogin}</Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}
