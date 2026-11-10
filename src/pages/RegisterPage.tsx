/**
 * Registration form. Client-side validation mirrors the server rules
 * (usernameProblem / passwordProblem from shared/constants, the e-mail shape
 * below). Errors are bound to their fields with aria-describedby + aria-invalid;
 * on submit the number of errors is announced and the first invalid field
 * receives focus. Server errors (USERNAME_TAKEN, WEAK_PASSWORD, VALIDATION with
 * a field - including the 409 for an e-mail that is already registered) land on
 * the matching field, anything else in an Alert.
 *
 * One e-mail address and one username belong to one account only (first and last
 * names may repeat). The server enforces that case-insensitively; its 409 answers
 * are shown at the field in the client wording ("Error: This username is already
 * taken. Please choose another one." / "Error: This email address is already
 * registered.") and announced in full.
 *
 * The e-mail address is used to log in and to reset a forgotten password (the
 * reset link and code are e-mailed to it); here only its shape is checked.
 *
 * Above the submit button sits the consent checkbox (RegisterPrivacyConsent, docs/android-tasks/PRIVACY-CHECKBOX.md,
 * docs/apple-tasks/TERMS.md): ONE box, ONE sentence - "I have read the Privacy Policy and the Terms of Use, and I
 * agree to them" - where both document names link to their pages on the diary server (opened outside the app).
 * Ticking it confirms both documents: the request carries `privacyAccepted: true` and `termsAccepted: true`.
 * It replaced the former line "By creating an account, you agree to our Privacy policy." - one sentence that both
 * links the documents and takes the confirmation reads better than two that say nearly the same. Without the
 * tick no request is sent: the error appears under the box, the box gets the focus and the error is announced (in full when it is the only one; otherwise the number of
 * errors, like the fields). "Create account" stays enabled on purpose - a disabled button cannot be
 * focused and does not say why it does nothing; pressing it explains. A hosted server refuses a
 * registration without `privacyAccepted: true` or `termsAccepted: true` as well (400, field 'privacyAccepted' /
 * 'termsAccepted' - both shown at the box).
 *
 * The card ends with the tour button ("Skip - just look around", SkipTourButton)
 * in the Android app; it renders nothing in the Windows app and the web UI.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PASSWORD_MIN_LENGTH, passwordProblem, usernameProblem } from '@shared/constants';
import { isApiClientError } from '@/api';
import { RegisterPrivacyConsent } from '@/components/legal/PrivacyPolicyLink';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TextInput } from '@/components/ui/TextInput';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { getCurrentLocale } from '@/i18n/runtime';
import { errorCode, errorField, errorMessage } from '@/utils/errors';
import { setLastUsername } from '@/utils/last-username';
import { SkipTourButton } from './onboarding/SkipTourButton';

type FieldName = 'firstName' | 'lastName' | 'username' | 'email' | 'password' | 'confirmPassword';
type Errors = Partial<Record<FieldName, string>>;

/** Field order = focus order for "first invalid field". */
const FIELD_ORDER: FieldName[] = ['firstName', 'lastName', 'email', 'username', 'password', 'confirmPassword'];
/** Field labels, read in the current language when used (never at import time). */
const LABELS: Record<FieldName, () => string> = {
  firstName: () => T.firstName,
  lastName: () => T.lastName,
  username: () => T.username,
  email: () => T.email,
  password: () => T.password,
  confirmPassword: () => T.confirmPassword,
};

/** Same limits as the server (server/src/security/auth-service.ts): shape only, at most 254 characters. */
export const EMAIL_MAX_LENGTH = 254;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Problem with a (non-empty) e-mail address in the current language, or null when it looks fine. */
export function emailProblem(email: string): string | null {
  const trimmed = email.trim();
  if (trimmed.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(trimmed)) return T.emailInvalid;
  return null;
}

/**
 * The client wording of a duplicate-account answer from the server (a taken
 * username, an e-mail address that is already registered), or null for any
 * other error. `field` is the field the error was mapped to.
 */
export function duplicateMessage(err: unknown, field: string | null): string | null {
  if (!isApiClientError(err)) return null;
  if (err.code === 'USERNAME_TAKEN') return T.usernameTaken;
  // The error-code set has no EMAIL_TAKEN: a registered address arrives as 409 VALIDATION on the e-mail field.
  if (field === 'email' && err.status === 409) return T.emailTaken;
  return null;
}

export function fieldId(name: FieldName): string {
  return `register-${name}`;
}

/** Id of the consent checkbox (its error is `${CONSENT_ID}-error`); the field names the server uses for it. */
export const CONSENT_ID = 'register-privacyAccepted';
const CONSENT_FIELDS = ['privacyAccepted', 'termsAccepted'];

/** Pure validation used by the page (exported for tests). */
export function validateRegistration(values: Record<FieldName, string>): Errors {
  const errors: Errors = {};
  for (const name of FIELD_ORDER) {
    if (!values[name].trim()) errors[name] = T.fieldRequired(LABELS[name]());
  }
  if (!errors.username) {
    const problem = usernameProblem(values.username.trim(), getCurrentLocale());
    if (problem) errors.username = problem;
  }
  if (!errors.email) {
    const problem = emailProblem(values.email);
    if (problem) errors.email = problem;
  }
  if (!errors.password) {
    const problem = passwordProblem(values.password, getCurrentLocale());
    if (problem) errors.password = problem;
  }
  if (!errors.confirmPassword && values.confirmPassword !== values.password) {
    errors.confirmPassword = T.passwordsMismatch;
  }
  return errors;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const { announce } = useAnnouncer();
  const { redirectAfterAuth } = useAuthRedirect();

  const [values, setValues] = useState<Record<FieldName, string>>({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [rememberMe, setRememberMe] = useState(true);
  // The privacy checkbox starts unticked: ticking it is the user's own confirmation.
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setValue = (name: FieldName, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const setConsent = (checked: boolean) => {
    setPrivacyAccepted(checked);
    if (checked) setConsentError(null);
  };

  /** Focus order: the fields first, the checkbox last (its place on the form). */
  const focusFirstInvalid = (errs: Errors, consentMissing = false) => {
    const first = FIELD_ORDER.find((name) => errs[name]);
    if (first) document.getElementById(fieldId(first))?.focus();
    else if (consentMissing) document.getElementById(CONSENT_ID)?.focus();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setServerError(null);
    const next = validateRegistration(values);
    const consentMissing = !privacyAccepted;
    setErrors(next);
    setConsentError(consentMissing ? T.privacyConsentRequired : null);
    const count = FIELD_ORDER.filter((name) => next[name]).length + (consentMissing ? 1 : 0);
    if (count > 0) {
      // Nothing is sent. Only the box missing: its message in full; otherwise the number of errors
      // (the focused field or box reads its own message).
      announce(count === 1 && consentMissing ? T.privacyConsentRequired : T.fixErrors(count), 'assertive');
      focusFirstInvalid(next, consentMissing);
      return;
    }
    setBusy(true);
    try {
      const user = await register({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
        confirmPassword: values.confirmPassword,
        rememberMe,
        // The one box confirms both documents (docs/apple-tasks/TERMS.md).
        privacyAccepted: true,
        termsAccepted: true,
      });
      // The next login on this device starts with this name already filled in.
      setLastUsername(user.username || values.username.trim());
      toast.success(T.accountCreated(user.firstName));
      redirectAfterAuth();
    } catch (err) {
      const code = errorCode(err);
      // The server's refusal of a registration without the box (a hosted server checks it too): at the box, in the client wording.
      if (CONSENT_FIELDS.includes(errorField(err) ?? '')) {
        setPrivacyAccepted(false);
        setConsentError(T.privacyConsentRequired);
        announce(T.privacyConsentRequired, 'assertive');
        focusFirstInvalid({}, true);
        return;
      }
      let field = errorField(err) as FieldName | null;
      if (!field && code === 'USERNAME_TAKEN') field = 'username';
      if (!field && code === 'WEAK_PASSWORD') field = 'password';
      // A taken username / registered e-mail is shown with the client wording, in the UI language.
      const duplicate = duplicateMessage(err, field);
      const message = duplicate ?? errorMessage(err);
      if (field && FIELD_ORDER.includes(field)) {
        const errs: Errors = { [field]: message };
        setErrors(errs);
        // A duplicate is announced in full; other field errors by their count (the field reads its message on focus).
        announce(duplicate ?? T.fixErrors(1), 'assertive');
        focusFirstInvalid(errs);
      } else {
        setServerError(message);
        announce(message, 'assertive');
      }
    } finally {
      setBusy(false);
    }
  };

  const textField = (name: FieldName, autoComplete: string, extra: { dir?: 'ltr'; hint?: string; type?: 'email' } = {}) => (
    <Field id={fieldId(name)} label={LABELS[name]()} error={errors[name]} hint={extra.hint} required>
      {(a11y) => (
        <TextInput
          {...a11y}
          name={name}
          type={extra.type}
          autoComplete={autoComplete}
          dir={extra.dir}
          autoCapitalize={extra.dir ? 'off' : undefined}
          spellCheck={extra.dir ? false : undefined}
          value={values[name]}
          onChange={(e) => setValue(name, e.currentTarget.value)}
        />
      )}
    </Field>
  );

  const passwordField = (name: 'password' | 'confirmPassword', hint?: string) => (
    <Field id={fieldId(name)} label={LABELS[name]()} error={errors[name]} hint={hint} required>
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

  return (
    <div className="auth-card">
      <PageTitle title={T.registerTitle} />
      <Card>
        {serverError && (
          <Alert kind="error" role="none" id="register-server-error">
            {serverError}
          </Alert>
        )}
        <form className="form" onSubmit={onSubmit} noValidate aria-describedby={serverError ? 'register-server-error' : undefined}>
          {textField('firstName', 'given-name')}
          {textField('lastName', 'family-name')}
          {textField('email', 'email', { dir: 'ltr', hint: T.emailHint, type: 'email' })}
          {textField('username', 'username', { dir: 'ltr', hint: T.usernameHint })}
          {passwordField('password', T.passwordHint(PASSWORD_MIN_LENGTH))}
          {passwordField('confirmPassword')}
          <Checkbox id="register-remember" label={T.rememberMe} hint={T.rememberMeHint} checked={rememberMe} onChange={setRememberMe} />
          {/* "I have read the Privacy Policy and the Terms of Use, and I agree to them" - required; the links open outside the app. */}
          <RegisterPrivacyConsent id={CONSENT_ID} checked={privacyAccepted} onChange={setConsent} error={consentError} />
          <div className="form__actions">
            <Button type="submit" loading={busy} size="lg">
              {T.createAccount}
            </Button>
          </div>
        </form>
        <p className="auth-switch">
          {T.alreadyHaveAccount} <Link to={PATHS.login}>{T.login}</Link>
        </p>
        {/* The Android app only (unless its server turned the tour off); nothing in the Windows app and the web UI. */}
        <SkipTourButton />
      </Card>
    </div>
  );
}
