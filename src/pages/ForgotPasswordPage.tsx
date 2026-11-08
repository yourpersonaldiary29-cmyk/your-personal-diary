/**
 * "Forgot password" page (/forgot-password, public - it works over the remote
 * HTTPS address too). The visitor types the e-mail address they registered with
 * and the server e-mails a link and a 6-digit code for choosing a new password
 * (POST /api/auth/forgot-password). The diary itself is kept: the server re-opens
 * it with the recovery key and re-encrypts it under the new password.
 *
 * The server's answer is always the same, whether or not the address is
 * registered (no account enumeration), so the page shows that answer as it is
 * ("If this address is registered, we sent a link and a code to it.") plus the
 * next steps, and offers "Enter the code from the e-mail" (/reset-password with
 * the address in the router state - never in the URL). While the owner has not
 * set up sending mail, `server.info().passwordResetAvailable === false` shows a
 * notice up front; when the server answers 503 'server.mail.notConfigured' the
 * same notice is shown (and announced) - never a second box saying the same. Other
 * refusals (429 "too many requests") are shown in an error Alert.
 *
 * The login page passes an e-mail address typed into its identifier field in
 * `location.state.email`, so the field starts filled in.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth as authApi, isApiClientError, server as serverApi } from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { TextInput } from '@/components/ui/TextInput';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { errorField, errorMessage } from '@/utils/errors';
import { emailProblem } from './RegisterPage';

export const FORGOT_EMAIL_ID = 'forgot-email';
/** The "not set up on this computer" notice (focused when a request is refused for that reason). */
export const FORGOT_NOTICE_ID = 'forgot-not-available';

/** Router state the login / reset pages pass along: `{ email }` (never put in the URL). */
export function emailFromState(state: unknown): string {
  if (state && typeof state === 'object') {
    const email = (state as { email?: unknown }).email;
    if (typeof email === 'string') return email.trim();
  }
  return '';
}

export default function ForgotPasswordPage() {
  const location = useLocation();
  const { announce } = useAnnouncer();

  const [email, setEmail] = useState(() => emailFromState(location.state));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  /** The server's answer after a request (the same for every address). */
  const [sent, setSent] = useState<string | null>(null);
  /** The address the last request was sent for (carried to the code form). */
  const [sentFor, setSentFor] = useState('');
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  // Tell the visitor up front when the owner has not set up sending mail (older servers say nothing).
  useEffect(() => {
    let cancelled = false;
    serverApi.info().then(
      (info) => {
        if (!cancelled && info && info.passwordResetAvailable === false) setUnavailable(true);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setServerError(null);
    const trimmed = email.trim();
    const problem = trimmed ? emailProblem(trimmed) : T.fieldRequired(T.forgotEmail);
    setFieldError(problem);
    if (problem) {
      announce(T.fixErrors(1), 'assertive');
      document.getElementById(FORGOT_EMAIL_ID)?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.forgotPassword({ email: trimmed });
      const message = (res && typeof res.message === 'string' && res.message) || T.forgotSent;
      setSent(message);
      setSentFor(trimmed);
      setUnavailable(false);
      announce(`${message} ${T.forgotSentNext}`, 'polite');
    } catch (err) {
      // Mail is not set up: the notice already says so (with the card's real name) - show and speak
      // that one message instead of a second, almost identical error box.
      if (isApiClientError(err) && err.status === 503) {
        setUnavailable(true);
        announce(T.forgotNotAvailable, 'assertive');
        document.getElementById(FORGOT_NOTICE_ID)?.focus();
        return;
      }
      // The server counts requests only once sending mail is set up: a "too many requests" answer
      // means the "not set up" notice shown earlier is out of date.
      if (isApiClientError(err) && err.status === 429) setUnavailable(false);
      const message = errorMessage(err);
      if (errorField(err) === 'email') {
        setFieldError(message);
        document.getElementById(FORGOT_EMAIL_ID)?.focus();
      } else {
        setServerError(message);
      }
      announce(message, 'assertive');
    } finally {
      setBusy(false);
    }
  };

  const codeEmail = sentFor || email.trim();

  return (
    <div className="auth-card">
      <PageTitle title={T.forgotTitle} />
      <Card>
        <div className="stack-sm">
          {unavailable && !sent && (
            // Read in page order; after a submit it is announced (and focused) by onSubmit.
            <Alert kind="info" role="none" id={FORGOT_NOTICE_ID} tabIndex={-1}>
              {T.forgotNotAvailable}
            </Alert>
          )}
          {serverError && (
            <Alert kind="error" role="none" id="forgot-server-error">
              {serverError}
            </Alert>
          )}
          {sent && (
            // Announced through the live region above; the box itself stays silent (no double reading).
            <Alert kind="success" role="none" data-testid="forgot-sent">
              <p>{sent}</p>
              <p>{T.forgotSentNext}</p>
            </Alert>
          )}
          <p>{T.forgotIntro}</p>
        </div>
        <form className="form" onSubmit={onSubmit} noValidate aria-describedby={serverError ? 'forgot-server-error' : undefined}>
          <Field id={FORGOT_EMAIL_ID} label={T.forgotEmail} error={fieldError} required>
            {(a11y) => (
              <TextInput
                {...a11y}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                dir="ltr"
                autoCapitalize="off"
                spellCheck={false}
                value={email}
                onChange={(e) => {
                  setEmail(e.currentTarget.value);
                  if (fieldError) setFieldError(null);
                }}
              />
            )}
          </Field>
          <div className="form__actions">
            <Button type="submit" loading={busy} size="lg">
              {sent ? T.forgotSendAgain : T.forgotSubmit}
            </Button>
          </div>
        </form>
        <ul className="auth-next">
          <li>
            <Link to={PATHS.resetPassword} state={codeEmail ? { email: codeEmail } : undefined}>
              {T.forgotHaveCode}
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
