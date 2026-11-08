/**
 * "Forgot password" page: the e-mail field (prefilled from the login page's
 * router state), client validation, the server's always-identical answer with
 * the next steps, the "not set up yet" notice and the 503 / 429 answers, and the
 * link to the code form carrying the address in the router state (never the URL).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { ServerInfo } from '@shared/types';
import * as api from '@/api';
import { ApiClientError } from '@/api';
import { T } from '@/constants/texts';
import { assertiveRegion, politeRegion, renderWithProviders } from '@/test/render';
import ForgotPasswordPage, { FORGOT_EMAIL_ID, emailFromState } from './ForgotPasswordPage';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

const SENT_HE = 'אם הכתובת הזו רשומה, שלחנו אליה קישור וקוד.';

function info(overrides: Partial<ServerInfo> = {}): ServerInfo {
  return {
    version: '0.1.0',
    port: 47321,
    lanEnabled: false,
    lanUrls: [],
    dataDir: '',
    isLocalRequest: false,
    startedAt: '2026-09-29T08:00:00.000Z',
    ...overrides,
  };
}

/** Shows where the "Enter the code" link went and the router state it carried. */
function ResetProbe() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';
  return <p data-testid="reset-probe">{`${location.pathname}${location.search}|${email}`}</p>;
}

function renderPage(state?: unknown, locale?: 'en' | 'he') {
  return renderWithProviders(
    <Routes>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetProbe />} />
      <Route path="/login" element={<p data-testid="login-page">login</p>} />
    </Routes>,
    { auth: 'anonymous', initialEntries: [{ pathname: '/forgot-password', state }], locale },
  );
}

const emailInput = () => document.getElementById(FORGOT_EMAIL_ID) as HTMLInputElement;
const submitButton = () => screen.getByRole('button', { name: T.forgotSubmit });

beforeEach(() => {
  vi.mocked(api.server.info).mockReset().mockResolvedValue(info({ passwordResetAvailable: true }));
  vi.mocked(api.auth.forgotPassword).mockReset().mockResolvedValue({ ok: true, message: SENT_HE });
});

describe('ForgotPasswordPage', () => {
  it('renders the title, the explanation and a required, left-to-right e-mail field', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: T.forgotTitle })).toBeInTheDocument();
    expect(document.title).toContain(T.forgotTitle);
    expect(screen.getByText(T.forgotIntro)).toBeInTheDocument();
    const email = emailInput();
    expect(email).toBe(screen.getByRole('textbox', { name: new RegExp(`^${T.forgotEmail}`) }));
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(email).toHaveAttribute('dir', 'ltr');
    expect(email).toHaveAttribute('aria-required', 'true');
    expect(email).toHaveValue('');
    expect(submitButton()).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('link', { name: T.backToLogin })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: T.forgotHaveCode })).toHaveAttribute('href', '/reset-password');
    await waitFor(() => expect(api.server.info).toHaveBeenCalled());
    expect(screen.queryByText(T.forgotNotAvailable)).not.toBeInTheDocument();
  });

  it('starts with the address the login page passed in its router state', () => {
    renderPage({ email: ' dana@example.com ' });
    expect(emailInput()).toHaveValue('dana@example.com');
    expect(emailFromState({ email: 'a@b.co' })).toBe('a@b.co');
    expect(emailFromState(null)).toBe('');
    expect(emailFromState({ email: 5 })).toBe('');
  });

  it('checks the address before asking the server, focuses the field and announces the error', async () => {
    const { user } = renderPage();
    await user.click(submitButton());
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput()).toHaveAccessibleDescription(T.fieldRequired(T.forgotEmail));
    expect(emailInput()).toHaveFocus();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(1)));

    await user.type(emailInput(), 'dana@example');
    expect(emailInput()).not.toHaveAttribute('aria-invalid');
    await user.click(submitButton());
    expect(emailInput()).toHaveAccessibleDescription(T.emailInvalid);
    expect(api.auth.forgotPassword).not.toHaveBeenCalled();
  });

  it('sends the trimmed address and shows the server answer with the next steps; the code link carries the address', async () => {
    const { user } = renderPage();
    await user.type(emailInput(), '  Dana@Example.com ');
    await user.click(submitButton());

    await waitFor(() => expect(api.auth.forgotPassword).toHaveBeenCalledWith({ email: 'Dana@Example.com' }));
    const box = await screen.findByTestId('forgot-sent');
    expect(box).toHaveTextContent(SENT_HE);
    expect(box).toHaveTextContent(T.forgotSentNext);
    // Announced once, politely (the box itself is not a live region).
    expect(box).not.toHaveAttribute('role');
    await waitFor(() => expect(politeRegion()).toHaveTextContent(`${SENT_HE} ${T.forgotSentNext}`));
    // The button now offers to send again.
    expect(screen.getByRole('button', { name: T.forgotSendAgain })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: T.forgotSubmit })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: T.forgotHaveCode }));
    // The address travels in the router state, never in the URL.
    expect(screen.getByTestId('reset-probe')).toHaveTextContent('/reset-password|Dana@Example.com');
  });

  it('falls back to the client wording when the answer carries no message', async () => {
    vi.mocked(api.auth.forgotPassword).mockResolvedValue({ ok: true } as never);
    const { user } = renderPage();
    await user.type(emailInput(), 'nobody@example.com');
    await user.click(submitButton());
    expect(await screen.findByTestId('forgot-sent')).toHaveTextContent(T.forgotSent);
    expect(T.forgotSent).toBe(SENT_HE);
  });

  it('says up front when password reset by e-mail is not set up on this diary', async () => {
    vi.mocked(api.server.info).mockResolvedValue(info({ passwordResetAvailable: false }));
    renderPage();
    expect(await screen.findByText(T.forgotNotAvailable)).toBeInTheDocument();
  });

  it('says nothing up front when the server does not report it (older server) or cannot be reached', async () => {
    vi.mocked(api.server.info).mockResolvedValue(info());
    const first = renderPage();
    await waitFor(() => expect(api.server.info).toHaveBeenCalled());
    expect(screen.queryByText(T.forgotNotAvailable)).not.toBeInTheDocument();
    first.unmount();

    vi.mocked(api.server.info).mockRejectedValue(new ApiClientError(0, { code: 'OTHER', message: T.noServer }));
    renderPage();
    await waitFor(() => expect(api.server.info).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(T.forgotNotAvailable)).not.toBeInTheDocument();
    expect(document.querySelector('.alert--error')).toBeNull();
  });

  it('answers a 503 "not set up" with the one notice (no second box), and a 429 in an error box - each spoken once', async () => {
    vi.mocked(api.server.info).mockResolvedValue(info({ passwordResetAvailable: false }));
    vi.mocked(api.auth.forgotPassword).mockRejectedValue(
      new ApiClientError(503, { code: 'OTHER', message: 'איפוס סיסמה במייל לא הוגדר במחשב הזה.' }),
    );
    const { user } = renderPage();
    const notice = await screen.findByText(T.forgotNotAvailable);
    await user.type(emailInput(), 'dana@example.com');
    await user.click(submitButton());
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.forgotNotAvailable));
    expect(notice.closest('.alert')).toHaveFocus();
    // Only the notice: no error box repeating the server's sentence.
    expect(document.querySelector('.alert--error')).toBeNull();
    expect(screen.queryByText('איפוס סיסמה במייל לא הוגדר במחשב הזה.')).not.toBeInTheDocument();
    expect([...document.querySelectorAll('.alert')].filter((el) => el.textContent?.includes(T.forgotNotAvailable))).toHaveLength(1);
    expect(screen.queryByTestId('forgot-sent')).not.toBeInTheDocument();
    expect(emailInput()).not.toHaveAttribute('aria-invalid');

    vi.mocked(api.auth.forgotPassword).mockRejectedValue(new ApiClientError(429, { code: 'OTHER', message: 'יותר מדי בקשות. יש לנסות שוב מאוחר יותר.' }));
    await user.click(submitButton());
    await waitFor(() => expect(document.querySelector('.alert--error')).toHaveTextContent('יותר מדי בקשות'));
    // Spoken through the announcer only - the box is not a second live region.
    expect(document.querySelector('.alert--error[role="alert"]')).toBeNull();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent('יותר מדי בקשות'));
    // Requests are counted only once mail is set up: the "not set up" notice is out of date now.
    expect(screen.queryByText(T.forgotNotAvailable)).not.toBeInTheDocument();
  });

  it('shows a server validation error for the address at the field', async () => {
    vi.mocked(api.auth.forgotPassword).mockRejectedValue(
      new ApiClientError(400, { code: 'VALIDATION', message: 'כתובת הדוא״ל ארוכה מדי', field: 'email' }),
    );
    const { user } = renderPage();
    await user.type(emailInput(), 'dana@example.com');
    await user.click(submitButton());
    await waitFor(() => expect(emailInput()).toHaveAttribute('aria-invalid', 'true'));
    expect(emailInput()).toHaveAccessibleDescription('כתובת הדוא״ל ארוכה מדי');
    expect(emailInput()).toHaveFocus();
    expect(document.querySelector('.alert--error')).toBeNull();
  });

  it('speaks English when the UI is in English', async () => {
    vi.mocked(api.auth.forgotPassword).mockResolvedValue({ ok: true, message: 'If this address is registered, we sent a link and a code to it.' });
    const { user } = renderPage(undefined, 'en');
    expect(screen.getByRole('heading', { level: 1, name: 'Forgot password' })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^E-mail address you registered with/), 'dana@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByTestId('forgot-sent')).toHaveTextContent('valid for 30 minutes');
  });
});
