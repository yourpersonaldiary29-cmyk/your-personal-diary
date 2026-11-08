/**
 * Login form: "Username or e-mail" (the server resolves either, case-insensitively),
 * password, "Remember me" (checked by default). A wrong password shows the
 * server's message in an Alert (role="alert", announced assertively) and
 * focuses the password field. On success a toast greets the user, the
 * username (as the server spells it) is remembered for next time and the
 * visitor returns to the page they originally asked for.
 *
 * On the user's own computer (server.info().isLocalRequest) the page also lists
 * the accounts registered here ("Accounts registered on this computer"): one button per
 * account fills the username and moves focus to the password field. The
 * username starts prefilled with the name remembered on this device, or else
 * with the account the server lists first - the one that signed in most
 * recently on this computer (the server keeps that in its registry). When the
 * list cannot be loaded (phone, server down, older server) the section simply
 * stays hidden - no error.
 *
 * Right before the "Log in" button a "Forgot password?" link leads to
 * /forgot-password (password reset by e-mail). When the identifier field holds
 * an e-mail address it travels along in the router state (never in the URL) so
 * that page starts filled in.
 *
 * The card ends with the tour button ("Skip - just look around", SkipTourButton)
 * in the Android app; it renders nothing in the Windows app and the web UI.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth as authApi, server as serverApi, type AccountSummary } from '@/api';
import { SignedOutPendingNotice } from '@/components/sync/WaitingNotices';
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
import { readUserLocale, trWith } from '@/i18n/runtime';
import { errorField, errorMessage } from '@/utils/errors';
import { getLastUsername, setLastUsername } from '@/utils/last-username';
import { SkipTourButton } from './onboarding/SkipTourButton';

interface LoginErrors {
  username?: string;
  password?: string;
}

/** Usernames (and e-mail addresses) are unique case-insensitively on the server. */
function sameUsername(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** True when the typed identifier - the username or the e-mail address, in any letter case - belongs to `account`. */
function matchesAccount(account: AccountSummary, typed: string): boolean {
  return sameUsername(account.username, typed) || (!!account.email && sameUsername(account.email, typed));
}

/** Only well-formed entries are shown (the response is data from the server, checked defensively). */
function isAccountSummary(v: unknown): v is AccountSummary {
  if (!v || typeof v !== 'object') return false;
  const a = v as Record<string, unknown>;
  return typeof a.username === 'string' && a.username.trim() !== '' && typeof a.firstName === 'string' && typeof a.lastName === 'string';
}

/**
 * Loads the accounts registered on this computer. Resolves to [] anywhere the
 * list is not available (phone / LAN, server down, request refused).
 */
async function loadLocalAccounts(): Promise<AccountSummary[]> {
  try {
    const info = await serverApi.info();
    if (!info || info.isLocalRequest !== true) return [];
    const res = await authApi.accounts();
    const list = res && Array.isArray(res.accounts) ? res.accounts : [];
    return list.filter(isAccountSummary);
  } catch {
    return [];
  }
}

/** `{ username }` passed by the reset page in the router state ('' when absent). Exported for tests. */
export function usernameFromState(state: unknown): string {
  if (state && typeof state === 'object') {
    const name = (state as { username?: unknown }).username;
    if (typeof name === 'string') return name.trim();
  }
  return '';
}

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const { announce } = useAnnouncer();
  const { redirectAfterAuth } = useAuthRedirect();
  const accountsHeadingId = useId();
  const accountsHintId = useId();

  const location = useLocation();
  // After a password reset the login page starts with the account that was reset (router state),
  // not the name that signed in last on this device.
  const stateUsername = usernameFromState(location.state);
  const [username, setUsername] = useState(() => stateUsername || getLastUsername() || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  /** Once the user has typed a name (or a reset handed one over) we never overwrite it with a suggestion. */
  const usernameTouched = useRef(!!stateUsername);

  // Registered accounts on this computer ----------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadLocalAccounts();
      if (cancelled || list.length === 0) return;
      setAccounts(list);
      if (usernameTouched.current) return;
      // The server lists the account that signed in most recently first (it remembers that in its
      // registry, so this works after a restart or with cleared browser storage). Start with it,
      // unless the name remembered on this device is another account that is still registered.
      setUsername((current) => (current && list.some((a) => sameUsername(a.username, current)) ? current : list[0].username));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseAccount = (account: AccountSummary) => {
    usernameTouched.current = true;
    setUsername(account.username);
    setErrors((prev) => (prev.username ? { ...prev, username: undefined } : prev));
    announce(T.accountFilled(account.username), 'polite');
    document.getElementById('login-password')?.focus();
  };

  const validate = (): LoginErrors => {
    const next: LoginErrors = {};
    if (!username.trim()) next.username = T.fieldRequired(T.usernameOrEmail);
    if (!password) next.password = T.fieldRequired(T.password);
    return next;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setServerError(null);
    const next = validate();
    setErrors(next);
    const invalid = (Object.keys(next) as (keyof LoginErrors)[]).filter((k) => next[k]);
    if (invalid.length > 0) {
      announce(T.fixErrors(invalid.length), 'assertive');
      document.getElementById(`login-${invalid[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const user = await login({ username: username.trim(), password, rememberMe });
      // Remember the name (in the server's spelling) so the next login starts filled in.
      setLastUsername(user.username || username.trim());
      // The UI switches to the account's language right after sign-in: greet in that language when
      // this device knows it (the account signed in here before), not in the login screen's.
      const accountLocale = user.id ? readUserLocale(user.id) : null;
      toast.success(accountLocale ? trWith(accountLocale)('auth.welcomeBack', { firstName: user.firstName }) : T.welcomeBack(user.firstName));
      redirectAfterAuth();
    } catch (err) {
      const field = errorField(err);
      const message = errorMessage(err);
      if (field === 'username' || field === 'password') {
        setErrors({ [field]: message });
        document.getElementById(`login-${field}`)?.focus();
      } else {
        setServerError(message);
        document.getElementById('login-password')?.focus();
      }
      announce(message, 'assertive');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <PageTitle title={T.loginTitle} />
      <Card>
        {/* Offline mode: a 401 kept this device's changes - they upload after this sign-in. */}
        <SignedOutPendingNotice />
        {serverError && (
          <Alert kind="error" role="none" id="login-server-error">
            {serverError}
          </Alert>
        )}
        {accounts.length > 0 && (
          <section className="stack-sm" aria-labelledby={accountsHeadingId} data-testid="registered-accounts">
            <h2 id={accountsHeadingId} className="card__title">
              {T.registeredAccounts}
            </h2>
            <p id={accountsHintId} className="text-muted text-small">
              {T.registeredAccountsHint}
            </p>
            <ul className="chips" aria-describedby={accountsHintId}>
              {accounts.map((account) => {
                // Marked while the field holds this account's username or e-mail (the chip itself always fills the username).
                const selected = matchesAccount(account, username);
                return (
                  <li key={account.username}>
                    <Button
                      type="button"
                      variant={selected ? 'primary' : 'secondary'}
                      size="sm"
                      icon={selected ? '✓' : undefined}
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => chooseAccount(account)}
                    >
                      {T.accountOption(account.firstName, account.lastName, account.username)}
                      {selected && <span className="visually-hidden"> ({T.accountSelected})</span>}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <form className="form" onSubmit={onSubmit} noValidate aria-describedby={serverError ? 'login-server-error' : undefined}>
          <Field id="login-username" label={T.usernameOrEmail} error={errors.username} required>
            {(a11y) => (
              <TextInput
                {...a11y}
                name="username"
                // "username" is the right autofill token for a sign-in identifier that may be an e-mail too.
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                dir="ltr"
                value={username}
                onChange={(e) => {
                  usernameTouched.current = true;
                  setUsername(e.currentTarget.value);
                  if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                }}
              />
            )}
          </Field>
          <Field id="login-password" label={T.password} error={errors.password} required>
            {(a11y) => (
              <PasswordInput
                {...a11y}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.currentTarget.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
              />
            )}
          </Field>
          <Checkbox id="login-remember" label={T.rememberMe} hint={T.rememberMeHint} checked={rememberMe} onChange={setRememberMe} />
          {/* Placed right before the Log in button (the owner's request), so it is also reached just before it with Tab. */}
          <p className="auth-forgot">
            <Link to={PATHS.forgotPassword} state={username.includes('@') ? { email: username.trim() } : undefined}>
              {T.forgotPasswordLink}
            </Link>
          </p>
          <div className="form__actions">
            <Button type="submit" loading={busy} size="lg">
              {T.login}
            </Button>
          </div>
        </form>
        <p className="auth-switch">
          {T.noAccountYet} <Link to={PATHS.register}>{T.register}</Link>
        </p>
        {/* The Android app only (unless its server turned the tour off); nothing in the Windows app and the web UI. */}
        <SkipTourButton />
      </Card>
    </div>
  );
}
