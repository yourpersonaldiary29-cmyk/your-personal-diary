/**
 * "Reset password" page: the e-mail link (token moved out of the visible
 * address, only the new password asked for), the 6-digit code form (address +
 * code, digits normalised), client validation, the server's "invalid / expired"
 * answer with the ways forward, a weak password from the server at its field,
 * and success (toast, this device signed out too, back to /login).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import * as api from '@/api';
import { ApiClientError } from '@/api';
import { T } from '@/constants/texts';
import { assertiveRegion, renderWithProviders, sampleUser, type FakeAuthStatus } from '@/test/render';
import ResetPasswordPage, { isResetAccount, normaliseResetCode, resetFieldId, validateReset, type ResetValues } from './ResetPasswordPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

const TOKEN = 'q2Vh3Xk9T1m8b4NwZr0cYp6sLd5uAe7g';
const NEW_PASSWORD = 'NewSecret123';
const DONE_HE = 'הסיסמה הוחלפה. החשבון נותק בכל המכשירים.';
const INVALID_HE = 'הקישור או הקוד אינם תקפים או שפג תוקפם. אפשר לבקש קישור חדש.';

/** Shows the current address (path + query) and the router state, so tests can check where the token went. */
function Probe() {
  const location = useLocation();
  const state = (location.state ?? {}) as { resetToken?: string; email?: string; username?: string };
  return (
    <p data-testid="probe">
      {`${location.pathname}${location.search}|token=${state.resetToken ?? ''}|email=${state.email ?? ''}|user=${state.username ?? ''}`}
    </p>
  );
}

function renderPage(entry: string | { pathname: string; search?: string; state?: unknown }, auth: FakeAuthStatus = 'anonymous', logout = vi.fn().mockResolvedValue(undefined)) {
  const utils = renderWithProviders(
    <>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<p data-testid="login-page">login</p>} />
        <Route path="/" element={<p data-testid="home-page">home</p>} />
        <Route path="/forgot-password" element={<p data-testid="forgot-page">forgot</p>} />
      </Routes>
      <Probe />
    </>,
    { auth, initialEntries: [entry], authOverrides: { logout } },
  );
  return { ...utils, logout };
}

const input = (name: 'email' | 'code' | 'newPassword' | 'confirmPassword') => document.getElementById(resetFieldId(name)) as HTMLInputElement | null;
const submit = () => screen.getByRole('button', { name: T.resetSubmit });
const probe = () => screen.getByTestId('probe').textContent ?? '';

const EMPTY: ResetValues = { email: '', code: '', newPassword: '', confirmPassword: '' };

beforeEach(() => {
  vi.mocked(api.auth.resetPassword).mockReset().mockResolvedValue({ ok: true, message: DONE_HE });
});

describe('reset helpers', () => {
  it('normalises the code to ASCII digits (spaces, hyphens, Arabic-Indic and Persian digits)', () => {
    expect(normaliseResetCode(' 123 456 ')).toBe('123456');
    expect(normaliseResetCode('123-456')).toBe('123456');
    expect(normaliseResetCode('١٢٣٤٥٦')).toBe('123456');
    expect(normaliseResetCode('۱۲۳۴۵۶')).toBe('123456');
  });

  it('validates only the fields of the current form', () => {
    expect(validateReset({ ...EMPTY, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, 'link')).toEqual({});
    expect(validateReset(EMPTY, 'link')).toEqual({
      newPassword: T.fieldRequired(T.resetNewPassword),
      confirmPassword: T.fieldRequired(T.resetConfirmPassword),
    });
    expect(validateReset(EMPTY, 'code')).toEqual({
      email: T.fieldRequired(T.forgotEmail),
      code: T.fieldRequired(T.resetCode),
      newPassword: T.fieldRequired(T.resetNewPassword),
      confirmPassword: T.fieldRequired(T.resetConfirmPassword),
    });
    const bad = validateReset({ email: 'dana@', code: '12345', newPassword: NEW_PASSWORD, confirmPassword: 'other' }, 'code');
    expect(bad).toEqual({ email: T.emailInvalid, code: T.resetCodeInvalid, confirmPassword: T.passwordsMismatch });
    expect(validateReset({ email: 'dana@example.com', code: '12 34 56', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, 'code')).toEqual({});
    // The password rules are the server's (shared passwordProblem).
    expect(validateReset({ ...EMPTY, newPassword: 'abc', confirmPassword: 'abc' }, 'link').newPassword).toBeTruthy();
  });
});

describe('ResetPasswordPage: the e-mail link', () => {
  it('moves the token out of the address, asks only for the new password twice and resets with the token', async () => {
    const { user } = renderPage(`/reset-password?token=${TOKEN}`);
    expect(screen.getByRole('heading', { level: 1, name: T.resetTitle })).toBeInTheDocument();
    expect(screen.getByText(T.resetIntroLink)).toBeInTheDocument();
    // The token left the visible address but is kept in this history entry's state.
    await waitFor(() => expect(probe()).toBe(`/reset-password|token=${TOKEN}|email=|user=`));
    expect(input('email')).toBeNull();
    expect(input('code')).toBeNull();
    const pw = input('newPassword') as HTMLInputElement;
    expect(pw.type).toBe('password');
    expect(pw).toHaveAttribute('autocomplete', 'new-password');
    expect(pw).toHaveAttribute('aria-required', 'true');
    expect(input('confirmPassword')).toHaveAttribute('autocomplete', 'new-password');

    await user.type(pw, NEW_PASSWORD);
    await user.type(input('confirmPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.click(submit());

    await waitFor(() =>
      expect(api.auth.resetPassword).toHaveBeenCalledWith({ token: TOKEN, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }),
    );
    expect(await screen.findByText(DONE_HE)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('login-page')).toBeInTheDocument());
  });

  it('keeps working from the history state after the address was cleaned (e.g. a reload)', async () => {
    const { user } = renderPage({ pathname: '/reset-password', state: { resetToken: TOKEN } });
    expect(screen.getByText(T.resetIntroLink)).toBeInTheDocument();
    await user.type(input('newPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.type(input('confirmPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.click(submit());
    await waitFor(() => expect(api.auth.resetPassword).toHaveBeenCalledWith(expect.objectContaining({ token: TOKEN })));
  });

  it('checks the passwords first: count announced, first invalid field focused, nothing sent', async () => {
    const { user } = renderPage(`/reset-password?token=${TOKEN}`);
    await user.type(input('newPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.type(input('confirmPassword') as HTMLInputElement, 'Different123');
    await user.click(submit());
    expect(input('confirmPassword')).toHaveAttribute('aria-invalid', 'true');
    expect(input('confirmPassword')).toHaveAccessibleDescription(T.passwordsMismatch);
    expect(input('confirmPassword')).toHaveFocus();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(1)));
    expect(api.auth.resetPassword).not.toHaveBeenCalled();
  });

  it('shows an invalid / expired link as the server phrased it, with "Request a new link" and the code form as ways forward', async () => {
    vi.mocked(api.auth.resetPassword).mockRejectedValue(new ApiClientError(400, { code: 'VALIDATION', message: INVALID_HE }));
    const { user } = renderPage(`/reset-password?token=${TOKEN}`);
    await user.type(input('newPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.type(input('confirmPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.click(submit());
    await waitFor(() => expect(document.querySelector('.alert--error:not([role])')).toHaveTextContent(INVALID_HE));
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(INVALID_HE));
    expect(screen.getByRole('link', { name: T.resetRequestNew })).toHaveAttribute('href', '/forgot-password');
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();

    // "Use the code from the e-mail instead" opens the code form and focuses the address.
    await user.click(screen.getByRole('button', { name: T.resetUseCode }));
    expect(screen.getByText(T.resetIntroCode)).toBeInTheDocument();
    await waitFor(() => expect(input('email')).toHaveFocus());
    expect(input('code')).toBeInTheDocument();
    expect(document.querySelector('.alert--error')).toBeNull();
    expect(screen.queryByRole('button', { name: T.resetUseCode })).not.toBeInTheDocument();
  });

  it('shows a weak password reported by the server at the new-password field', async () => {
    vi.mocked(api.auth.resetPassword).mockRejectedValue(new ApiClientError(400, { code: 'WEAK_PASSWORD', message: 'הסיסמה חלשה מדי' }));
    const { user } = renderPage(`/reset-password?token=${TOKEN}`);
    await user.type(input('newPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.type(input('confirmPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.click(submit());
    await waitFor(() => expect(input('newPassword')).toHaveAttribute('aria-invalid', 'true'));
    expect(input('newPassword')).toHaveAccessibleDescription(new RegExp('הסיסמה חלשה מדי'));
    expect(input('newPassword')).toHaveFocus();
    expect(document.querySelector('.alert--error')).toBeNull();
  });

  it('signs this device out too when its session is the account that was reset, and prefills that account on the login page', async () => {
    vi.mocked(api.auth.resetPassword).mockResolvedValue({ ok: true, message: DONE_HE, username: sampleUser.username });
    const { user, logout } = renderPage(`/reset-password?token=${TOKEN}`, 'authenticated');
    await user.type(input('newPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.type(input('confirmPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.click(submit());
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('login-page')).toBeInTheDocument());
    expect(probe()).toContain(`|user=${sampleUser.username}`);
  });

  it('keeps another account that is signed in on this device signed in, and returns it to the home page', async () => {
    vi.mocked(api.auth.resetPassword).mockResolvedValue({ ok: true, message: DONE_HE, username: 'noam_ux' });
    const { user, logout } = renderPage(`/reset-password?token=${TOKEN}`, 'authenticated');
    await user.type(input('newPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.type(input('confirmPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.click(submit());
    // The login page would only bounce the signed-in account to the home page.
    await waitFor(() => expect(screen.getByTestId('home-page')).toBeInTheDocument());
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it('isResetAccount compares the username, or the typed address when an older server does not report it', () => {
    const me = { username: 'Dana_UX', email: 'dana@example.com' };
    expect(isResetAccount(me, { username: 'dana_ux' }, '')).toBe(true);
    expect(isResetAccount(me, { username: 'noam_ux' }, 'dana@example.com')).toBe(false);
    expect(isResetAccount(me, {}, ' DANA@example.com ')).toBe(true);
    expect(isResetAccount(me, {}, '')).toBe(false);
  });

  it('does not sign out a device that had no session', async () => {
    const { user, logout } = renderPage(`/reset-password?token=${TOKEN}`);
    await user.type(input('newPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.type(input('confirmPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.click(submit());
    await waitFor(() => expect(screen.getByTestId('login-page')).toBeInTheDocument());
    expect(logout).not.toHaveBeenCalled();
  });
});

describe('ResetPasswordPage: the 6-digit code', () => {
  it('asks for the address and the code without a token, prefilled from the router state, and sends them normalised', async () => {
    const { user } = renderPage({ pathname: '/reset-password', state: { email: 'dana@example.com' } });
    expect(screen.getByText(T.resetIntroCode)).toBeInTheDocument();
    expect(input('email')).toHaveValue('dana@example.com');
    expect(input('email')).toHaveAttribute('type', 'email');
    const code = input('code') as HTMLInputElement;
    expect(code).toHaveAttribute('inputmode', 'numeric');
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    expect(code).toHaveAccessibleDescription(T.resetCodeHint);
    expect(screen.queryByRole('button', { name: T.resetUseCode })).not.toBeInTheDocument();

    await user.type(code, '123 456');
    await user.type(input('newPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.type(input('confirmPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.click(submit());
    await waitFor(() =>
      expect(api.auth.resetPassword).toHaveBeenCalledWith({
        email: 'dana@example.com',
        code: '123456',
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    );
    await waitFor(() => expect(screen.getByTestId('login-page')).toBeInTheDocument());
  });

  it('rejects a short code and a malformed address before calling the server', async () => {
    const { user } = renderPage('/reset-password');
    await user.type(input('email') as HTMLInputElement, 'dana@example');
    await user.type(input('code') as HTMLInputElement, '12345');
    await user.type(input('newPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.type(input('confirmPassword') as HTMLInputElement, NEW_PASSWORD);
    await user.click(submit());
    expect(input('email')).toHaveAccessibleDescription(T.emailInvalid);
    expect(input('code')).toHaveAccessibleDescription(`${T.resetCodeHint} ${T.resetCodeInvalid}`);
    expect(input('email')).toHaveFocus();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(2)));
    expect(api.auth.resetPassword).not.toHaveBeenCalled();
  });

  it('"Request a new link" carries the typed address to the forgot-password page', async () => {
    const { user } = renderPage({ pathname: '/reset-password', state: { email: 'dana@example.com' } });
    await user.click(screen.getByRole('link', { name: T.resetRequestNew }));
    expect(screen.getByTestId('forgot-page')).toBeInTheDocument();
    expect(probe()).toBe("/forgot-password|token=|email=dana@example.com|user=");
  });

  it('speaks English when the UI is in English', () => {
    renderWithProviders(
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>,
      { auth: 'anonymous', route: '/reset-password', locale: 'en' },
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Reset password' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Code from the e-mail/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save new password' })).toBeInTheDocument();
  });
});
