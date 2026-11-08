import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { ApiClientError } from '@/api';
import { T } from '@/constants/texts';
import { LocationDisplay, assertiveRegion, currentPath, renderWithProviders, sampleUser } from '@/test/render';
import { LAST_USERNAME_KEY } from '@/utils/last-username';
import RegisterPage, { CONSENT_ID, EMAIL_MAX_LENGTH, duplicateMessage, emailProblem, validateRegistration } from './RegisterPage';

/** The privacy checkbox (docs/android-tasks/PRIVACY-CHECKBOX.md), named by its sentence. */
const CONSENT_HE = 'קראתי את מדיניות הפרטיות והסכמתי לה';
const CONSENT_EN = 'I have read the Privacy policy and agree to it';
const consentBox = (name = CONSENT_HE) => screen.getByRole('checkbox', { name }) as HTMLInputElement;

function renderPage(register = vi.fn().mockResolvedValue(sampleUser), route = '/register') {
  const utils = renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<LocationDisplay />} />
    </Routes>,
    { auth: 'anonymous', route, authOverrides: { register } },
  );
  return { ...utils, register };
}

const emailInput = () => screen.getByLabelText(new RegExp(`^${T.email}`));

/** Fills every field validly and (unless `consent` is false) ticks the privacy checkbox. */
async function fillValid(user: ReturnType<typeof renderPage>['user'], email = 'dana@example.com', consent = true) {
  await user.type(screen.getByLabelText(/שם פרטי/), 'דנה');
  await user.type(screen.getByLabelText(/שם משפחה/), 'כהן');
  await user.type(screen.getByLabelText(/שם משתמש/), 'dana');
  if (email) await user.type(emailInput(), email);
  await user.type(screen.getByLabelText(/^סיסמה/), 'secret123');
  await user.type(screen.getByLabelText(/אישור סיסמה/), 'secret123');
  if (consent) await user.click(consentBox());
}

const VALID = { firstName: 'דנה', lastName: 'כהן', username: 'dana', email: 'dana@example.com', password: 'secret123', confirmPassword: 'secret123' };

describe('RegisterPage', () => {
  it('renders all fields, the remember-me checkbox and the "צור חשבון" button', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: T.registerTitle })).toBeInTheDocument();
    expect(screen.getByLabelText(/שם פרטי/)).toBeInTheDocument();
    expect(screen.getByLabelText(/שם משפחה/)).toBeInTheDocument();
    expect(screen.getByLabelText(/שם משתמש/)).toBeInTheDocument();
    expect(emailInput()).toBeInTheDocument();
    expect(screen.getByLabelText(/^סיסמה/)).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(/אישור סיסמה/)).toBeInTheDocument();
    const remember = screen.getByRole('checkbox', { name: new RegExp(T.rememberMe) });
    expect(remember).toHaveAccessibleDescription(T.rememberMeHint);
    expect(remember).toBeChecked(); // "זכור אותי" is on by default
    // The privacy checkbox is required and starts unticked: ticking it is the user's own confirmation.
    expect(consentBox()).not.toBeChecked();
    expect(consentBox()).toHaveAttribute('aria-required', 'true');
    // "Create account" stays enabled: pressing it explains what is missing.
    expect(screen.getByRole('button', { name: T.createAccount })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('button', { name: T.createAccount })).toBeEnabled();
  });

  it('the privacy checkbox replaces the former line: its sentence carries the link to the policy, above the submit button', async () => {
    const { user } = renderPage();
    expect(screen.queryByText(/ביצירת החשבון אתם מסכימים/)).toBeNull();
    const box = consentBox();
    expect(box).toHaveAttribute('id', CONSENT_ID);
    const link = screen.getByRole('link', { name: 'מדיניות הפרטיות' });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/[^/]+\/privacy\/he\/$/);
    expect(link).toHaveAttribute('target', '_blank');
    expect(box.labels?.[0]).toContainElement(link);
    // Before the submit button, so it is read and ticked before creating the account.
    const submit = screen.getByRole('button', { name: T.createAccount });
    expect(box.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Clicking the sentence ticks the box (a real label), and again unticks it.
    await user.click(box.labels?.[0] as HTMLLabelElement);
    expect(box).toBeChecked();
    await user.click(box.labels?.[0] as HTMLLabelElement);
    expect(box).not.toBeChecked();
  });

  it('no tick: no request; the error under the box, the focus on the box, the message announced in full', async () => {
    const { user, register } = renderPage();
    await fillValid(user, 'dana@example.com', false);
    await user.click(screen.getByRole('button', { name: T.createAccount }));

    const box = consentBox();
    expect(register).not.toHaveBeenCalled();
    expect(T.privacyConsentRequired).toBe('כדי ליצור חשבון, יש לסמן את התיבה ובכך לאשר שקראת את מדיניות הפרטיות ושהסכמת לה.');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription(T.privacyConsentRequired);
    expect(box).toHaveFocus();
    const error = document.getElementById(`${CONSENT_ID}-error`) as HTMLElement;
    expect(error).toHaveTextContent(T.privacyConsentRequired);
    expect(box.labels?.[0]).not.toContainElement(error);
    expect(box.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.privacyConsentRequired));
    // The other fields are fine and stay unmarked; nothing was remembered.
    expect(emailInput()).not.toHaveAttribute('aria-invalid');
    expect(window.localStorage.getItem(LAST_USERNAME_KEY)).toBeNull();

    // Ticking clears the error; the request then carries the confirmation.
    await user.click(box);
    expect(box).not.toHaveAttribute('aria-invalid');
    expect(document.getElementById(`${CONSENT_ID}-error`)).toBeNull();
    await user.click(screen.getByRole('button', { name: T.createAccount }));
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ username: 'dana', privacyAccepted: true }));
  });

  it('pressing Enter in a field without the tick sends nothing either', async () => {
    const { user, register } = renderPage();
    await fillValid(user, 'dana@example.com', false);
    await user.type(screen.getByLabelText(/אישור סיסמה/), '{Enter}');
    expect(register).not.toHaveBeenCalled();
    expect(consentBox()).toHaveFocus();
  });

  it('a server refusal on the field privacyAccepted (a hosted server checks too) lands at the box in the client wording', async () => {
    const register = vi.fn().mockRejectedValue(new ApiClientError(400, { code: 'VALIDATION', message: 'server text', field: 'privacyAccepted' }));
    const { user } = renderPage(register);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: T.createAccount }));

    const box = consentBox();
    await waitFor(() => expect(box).toHaveAttribute('aria-invalid', 'true'));
    expect(box).toHaveAccessibleDescription(T.privacyConsentRequired);
    expect(box).not.toBeChecked();
    expect(box).toHaveFocus();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.privacyConsentRequired));
    expect(document.querySelector('.alert--error')).toBeNull();
  });

  it('places the e-mail field right after the last name, as a required e-mail input with the local-only hint', () => {
    renderPage();
    const email = emailInput() as HTMLInputElement;
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(email).toHaveAttribute('dir', 'ltr');
    expect(email).toHaveAttribute('aria-required', 'true');
    expect(email).toHaveAccessibleDescription(T.emailHint);
    expect(email).not.toHaveAttribute('aria-invalid');
    // The visible label carries the "(חובה)" marker like every other field.
    expect(email.labels?.[0]).toHaveTextContent(`${T.email}(${T.required})`);
    // Order in the form: first name, last name, e-mail, username, password.
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('form input')).map((i) => i.name);
    expect(inputs.slice(0, 5)).toEqual(['firstName', 'lastName', 'email', 'username', 'password']);
  });

  it('submits with rememberMe: true by default and remembers the username for the next login', async () => {
    const register = vi.fn().mockResolvedValue({ ...sampleUser, username: 'Dana' });
    const { user } = renderPage(register);
    expect(window.localStorage.getItem(LAST_USERNAME_KEY)).toBeNull();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: T.createAccount }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ username: 'dana', email: 'dana@example.com', rememberMe: true, privacyAccepted: true }));
    // Stored as the server spells it, so the login page prefills the canonical name.
    await waitFor(() => expect(window.localStorage.getItem(LAST_USERNAME_KEY)).toBe('Dana'));
    expect(await screen.findByText(T.accountCreated('דנה'))).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe('/'));
  });

  it('does not remember the username when the registration fails', async () => {
    const register = vi.fn().mockRejectedValue(new ApiClientError(409, { code: 'USERNAME_TAKEN', message: 'שם המשתמש כבר תפוס' }));
    const { user } = renderPage(register);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: T.createAccount }));
    await waitFor(() => expect(screen.getByLabelText(/שם משתמש/)).toHaveAttribute('aria-invalid', 'true'));
    expect(window.localStorage.getItem(LAST_USERNAME_KEY)).toBeNull();
  });

  it('empty submit: marks every field and the privacy box invalid, announces the count and focuses the first field', async () => {
    const { user, register } = renderPage();
    await user.click(screen.getByRole('button', { name: T.createAccount }));

    const firstName = screen.getByLabelText(/שם פרטי/);
    expect(firstName).toHaveAttribute('aria-invalid', 'true');
    expect(firstName).toHaveAccessibleDescription(T.fieldRequired(T.firstName));
    expect(firstName).toHaveFocus();
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    // Hint and error are both read for the e-mail field.
    expect(emailInput()).toHaveAccessibleDescription(`${T.emailHint} ${T.fieldRequired(T.email)}`);
    expect(screen.getByLabelText(/אישור סיסמה/)).toHaveAttribute('aria-invalid', 'true');
    // Six fields and the unticked box.
    expect(consentBox()).toHaveAttribute('aria-invalid', 'true');
    expect(consentBox()).toHaveAccessibleDescription(T.privacyConsentRequired);
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(7)));
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects a malformed e-mail before calling the server, focuses the field and clears the error once fixed', async () => {
    const { user, register } = renderPage();
    await fillValid(user, 'dana@example');
    await user.click(screen.getByRole('button', { name: T.createAccount }));

    const email = emailInput();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription(new RegExp(T.emailInvalid));
    expect(email).toHaveFocus();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(1)));
    expect(register).not.toHaveBeenCalled();

    // Typing clears the error; a valid address goes through.
    await user.type(email, '.com');
    expect(email).not.toHaveAttribute('aria-invalid');
    await user.click(screen.getByRole('button', { name: T.createAccount }));
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ email: 'dana@example.com' }));
  });

  it('validates the e-mail with the server shape rule (same regex, 254 characters at most)', () => {
    expect(emailProblem('dana@example.com')).toBeNull();
    expect(emailProblem('  Dana.Cohen+diary@sub.example.co.il ')).toBeNull();
    for (const bad of ['dana', 'dana@', '@example.com', 'dana@example', 'dana cohen@example.com', 'dana@@example.com', `${'a'.repeat(EMAIL_MAX_LENGTH)}@x.io`]) {
      expect(emailProblem(bad), bad).toBe(T.emailInvalid);
    }
    expect(validateRegistration({ ...VALID, email: '' })).toEqual({ email: T.fieldRequired(T.email) });
    expect(validateRegistration({ ...VALID, email: 'nope' })).toEqual({ email: T.emailInvalid });
    expect(validateRegistration(VALID)).toEqual({});
  });

  it('rejects a weak password and mismatched confirmation', async () => {
    const { user, register } = renderPage();
    await user.type(screen.getByLabelText(/שם פרטי/), 'דנה');
    await user.type(screen.getByLabelText(/שם משפחה/), 'כהן');
    await user.type(screen.getByLabelText(/שם משתמש/), 'dana');
    await user.type(emailInput(), 'dana@example.com');
    await user.type(screen.getByLabelText(/^סיסמה/), 'secret123');
    await user.type(screen.getByLabelText(/אישור סיסמה/), 'secret124');
    await user.click(consentBox());
    await user.click(screen.getByRole('button', { name: T.createAccount }));

    const confirm = screen.getByLabelText(/אישור סיסמה/);
    expect(confirm).toHaveAttribute('aria-invalid', 'true');
    expect(confirm).toHaveAccessibleDescription(T.passwordsMismatch);
    expect(confirm).toHaveFocus();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(1)));
    expect(register).not.toHaveBeenCalled();

    // Fixing the field clears its error.
    await user.clear(confirm);
    await user.type(confirm, 'secret123');
    expect(confirm).not.toHaveAttribute('aria-invalid');
  });

  it('submits valid data (e-mail trimmed, case kept), shows the success toast and navigates to state.from', async () => {
    const register = vi.fn().mockResolvedValue(sampleUser);
    const { user } = renderWithProviders(
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>,
      { auth: 'anonymous', initialEntries: [{ pathname: '/register', state: { from: { pathname: '/habits' } } }], authOverrides: { register } },
    );
    await fillValid(user, ' Dana@Example.com ');
    await user.click(screen.getByRole('checkbox', { name: new RegExp(T.rememberMe) })); // uncheck (default checked)
    await user.click(screen.getByRole('button', { name: T.createAccount }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith({
      firstName: 'דנה',
      lastName: 'כהן',
      username: 'dana',
      email: 'Dana@Example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
      rememberMe: false,
      privacyAccepted: true,
    });
    expect(await screen.findByText(T.accountCreated('דנה'))).toBeInTheDocument();
    await waitFor(() => expect(currentPath()).toBe('/habits'));
  });

  it('shows a taken username (409 USERNAME_TAKEN) at the username field with the exact wording, announced in full', async () => {
    const register = vi.fn().mockRejectedValue(new ApiClientError(409, { code: 'USERNAME_TAKEN', message: 'שם המשתמש כבר תפוס', field: 'username' }));
    const { user } = renderPage(register);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: T.createAccount }));

    const username = screen.getByLabelText(/שם משתמש/);
    await waitFor(() => expect(username).toHaveAttribute('aria-invalid', 'true'));
    expect(T.usernameTaken).toBe('שגיאה: שם המשתמש הזה כבר תפוס. יש לבחור שם אחר.');
    expect(username).toHaveAccessibleDescription(`${T.usernameHint} ${T.usernameTaken}`);
    expect(username).toHaveFocus();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.usernameTaken));
    // Only the username is marked; the same first / last name may belong to other accounts.
    expect(emailInput()).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText(/שם פרטי/)).not.toHaveAttribute('aria-invalid');
    expect(document.querySelector('.alert--error')).toBeNull();
  });

  it('also maps a USERNAME_TAKEN answer without a field to the username field', async () => {
    const register = vi.fn().mockRejectedValue(new ApiClientError(409, { code: 'USERNAME_TAKEN', message: 'x' }));
    const { user } = renderPage(register);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: T.createAccount }));
    const username = screen.getByLabelText(/שם משתמש/);
    await waitFor(() => expect(username).toHaveAccessibleDescription(`${T.usernameHint} ${T.usernameTaken}`));
  });

  it('shows the duplicate messages in English when the UI is in English', async () => {
    const register = vi.fn().mockRejectedValue(new ApiClientError(409, { code: 'VALIDATION', message: 'x', field: 'email' }));
    const utils = renderWithProviders(
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
      </Routes>,
      { auth: 'anonymous', route: '/register', authOverrides: { register }, locale: 'en' },
    );
    expect(T.emailTaken).toBe('Error: This email address is already registered.');
    expect(T.usernameTaken).toBe('Error: This username is already taken. Please choose another one.');
    await utils.user.type(screen.getByLabelText(/^First name/), 'Dana');
    await utils.user.type(screen.getByLabelText(/^Last name/), 'Cohen');
    await utils.user.type(screen.getByLabelText(/^E-mail/), 'dana@example.com');
    await utils.user.type(screen.getByLabelText(/^Username/), 'dana');
    await utils.user.type(screen.getByLabelText(/^Password/), 'secret123');
    await utils.user.type(screen.getByLabelText(/^Confirm password/), 'secret123');
    await utils.user.click(consentBox(CONSENT_EN));
    await utils.user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.getByLabelText(/^E-mail/)).toHaveAccessibleDescription(`${T.emailHint} Error: This email address is already registered.`));
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent('Error: This email address is already registered.'));
  });

  it('maps duplicates with duplicateMessage (username by code, e-mail by 409 on the e-mail field) and nothing else', () => {
    expect(duplicateMessage(new ApiClientError(409, { code: 'USERNAME_TAKEN', message: 'x' }), 'username')).toBe(T.usernameTaken);
    expect(duplicateMessage(new ApiClientError(409, { code: 'VALIDATION', message: 'x', field: 'email' }), 'email')).toBe(T.emailTaken);
    expect(duplicateMessage(new ApiClientError(400, { code: 'VALIDATION', message: 'x', field: 'email' }), 'email')).toBeNull();
    expect(duplicateMessage(new ApiClientError(400, { code: 'WEAK_PASSWORD', message: 'x' }), 'password')).toBeNull();
    expect(duplicateMessage(new Error('x'), null)).toBeNull();
  });

  it('shows an already-registered e-mail (409 VALIDATION, field email) at the e-mail field with the client wording', async () => {
    const register = vi.fn().mockRejectedValue(new ApiClientError(409, { code: 'VALIDATION', message: 'כתובת הדוא״ל כבר רשומה', field: 'email' }));
    const { user } = renderPage(register);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: T.createAccount }));

    const email = emailInput();
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(T.emailTaken).toBe('שגיאה: כתובת המייל הזו כבר רשומה במערכת.');
    expect(email).toHaveAccessibleDescription(`${T.emailHint} ${T.emailTaken}`);
    expect(email).toHaveFocus();
    // Announced in full, not just as "1 error".
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.emailTaken));
    // Not a page-level alert, and the other fields stay valid.
    expect(document.querySelector('.alert--error')).toBeNull();
    expect(screen.getByLabelText(/שם משתמש/)).not.toHaveAttribute('aria-invalid');
    expect(window.localStorage.getItem(LAST_USERNAME_KEY)).toBeNull();
  });

  it('shows a server-side e-mail validation message (400) at the e-mail field as the server phrased it', async () => {
    const register = vi.fn().mockRejectedValue(new ApiClientError(400, { code: 'VALIDATION', message: 'כתובת הדוא״ל ארוכה מדי (עד 254 תווים)', field: 'email' }));
    const { user } = renderPage(register);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: T.createAccount }));

    const email = emailInput();
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveAccessibleDescription(/ארוכה מדי/);
    expect(email).toHaveFocus();
  });

  it('shows other server errors in an alert', async () => {
    const register = vi.fn().mockRejectedValue(new ApiClientError(0, { code: 'OTHER', message: T.noServer }));
    const { user } = renderPage(register);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: T.createAccount }));
    // The Alert box itself (no live role: the announcer speaks the message - once).
    await waitFor(() => expect(document.querySelector('.alert--error:not([role])')).toHaveTextContent(T.noServer));
  });
});

describe('every UI path that creates an account goes through this form and its privacy checkbox', () => {
  /** The UI sources (src/, without tests and test helpers) as `relative path -> text`. */
  async function uiSources(): Promise<Map<string, string>> {
    const load = (specifier: string) => import(/* @vite-ignore */ specifier);
    const fs = (await load('node:fs')) as { readdirSync(p: string, o: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>; readFileSync(p: string, e: 'utf8'): string };
    const { fileURLToPath } = (await load('node:url')) as { fileURLToPath(url: string): string };
    const { dirname, join, relative, sep } = (await load('node:path')) as { dirname(p: string): string; join(...p: string[]): string; relative(a: string, b: string): string; sep: string };
    const src = join(dirname(fileURLToPath(import.meta.url)), '..');
    const out = new Map<string, string>();
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'test') walk(full);
        } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          out.set(relative(src, full).split(sep).join('/'), fs.readFileSync(full, 'utf8'));
        }
      }
    };
    walk(src);
    return out;
  }

  it('one endpoint call (api), one caller of it (AuthContext), one user of that (this page) - the tour and every link only lead here', async () => {
    const files = await uiSources();
    expect(files.size).toBeGreaterThan(100);
    const having = (re: RegExp) => [...files].filter(([, text]) => re.test(text)).map(([file]) => file);
    expect(having(/['"`]\/api\/auth\/register['"`]/)).toEqual(['api/index.ts']);
    expect(having(/\b(?:authApi|auth|api\.auth)\.register\(/)).toEqual(['context/AuthContext.tsx']);
    expect(having(/\{[^}]*\bregister\b[^}]*\}\s*=\s*useAuth\(\)|useAuth\(\)\.register\b/)).toEqual(['pages/RegisterPage.tsx']);
    // The tour's "Create an account" (settings card and banner) opens this page; it creates nothing itself.
    for (const file of ['pages/onboarding/GuestAccountCard.tsx', 'components/GuestBanner.tsx']) {
      expect(files.get(file), file).toContain('navigate(PATHS.register');
    }
  });
});
