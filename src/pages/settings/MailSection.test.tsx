/**
 * "E-mail for password reset" card: shown only on the computer itself and only
 * to the account that owns the mail settings - the first account (`isMailOwner`
 * in the server settings; another account sees nothing and the card never even
 * asks for the settings; a 403 hides it too); the first setup (switch, Gmail address, App Password, advanced
 * server settings, the account password right above Save) and its validation;
 * the locked card once configured (summary, "Send test e-mail", "Change
 * settings" behind the password dialog); the Gmail App Password instructions;
 * and the texts in English and Hebrew.
 */
import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import type { MailSettingsView, ServerInfo, ServerSettings } from '@shared/types';
import * as api from '@/api';
import { ApiClientError } from '@/api';
import { T } from '@/constants/texts';
import { LockContext } from '@/context/LockContext';
import { __resetLocaleForTests, setCurrentLocale } from '@/i18n/runtime';
import { mailSettingsFixture } from '@/test/api-mock';
import { assertiveRegion, politeRegion, renderWithProviders, sampleUser } from '@/test/render';
import {
  MAIL_ADDRESS_ID,
  MAIL_APP_PASSWORD_ID,
  MAIL_CHANGE_BUTTON_ID,
  MAIL_ENABLED_ID,
  MAIL_HOST_ID,
  MAIL_PASSWORD_ID,
  MAIL_PORT_ID,
  MAIL_SECURITY_ID,
  MailSection,
  isGmailAppPassword,
  isGmailHost,
  isMailConfigured,
  isValidMailHost,
  normaliseAppPassword,
  normaliseMailHost,
} from './MailSection';
import { DEFAULT_MAIL_ADDRESS, MT } from './mailTexts';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

const PASSWORD = 'Passw0rd!';
/** A made-up App Password in the form Google shows it (4 groups of 4 letters). */
const APP_PASSWORD_SHOWN = 'abcd efgh ijkl mnop';
const APP_PASSWORD = 'abcdefghijklmnop';

const localInfo: ServerInfo = {
  version: '0.1.0',
  port: 47321,
  lanEnabled: false,
  lanUrls: [],
  dataDir: 'C:\\data',
  isLocalRequest: true,
  startedAt: '2026-09-29T08:00:00.000Z',
};

/** GET /api/server/settings of the owner (the first account on this computer). */
const ownerSettings: ServerSettings = { port: 47321, lanEnabled: false, isRemoteOwner: true, isMailOwner: true };

/** Mail set up and on, owned by the signed-in account. */
function configuredView(overrides: Partial<MailSettingsView> = {}): MailSettingsView {
  return mailSettingsFixture({
    enabled: true,
    username: DEFAULT_MAIL_ADDRESS,
    fromAddress: DEFAULT_MAIL_ADDRESS,
    smtpPasswordSet: true,
    ready: true,
    hasOwner: true,
    ...overrides,
  });
}

let verifyPassword: Mock<(password: string) => Promise<boolean>>;

/** Lock provider with real state, so a test can lock the app (Ctrl+L) while the card is open. */
let lockApp: () => void = () => {};
function StatefulLock({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  lockApp = () => setLocked(true);
  return <LockContext.Provider value={{ locked, restoredLocked: false, lock: () => setLocked(true), unlock: () => setLocked(false) }}>{children}</LockContext.Provider>;
}

function renderCard(user = sampleUser) {
  return renderWithProviders(
    <StatefulLock>
      <MailSection />
    </StatefulLock>,
    { auth: 'authenticated', user, authOverrides: { verifyPassword } },
  );
}

const escapeRe = (s: string) => s.replace(/[()?.*+[\]{}|^$\\]/g, '\\$&');
const card = () => screen.getByRole('heading', { level: 2, name: MT.title }).closest('section') as HTMLElement;
const byId = (id: string) => document.getElementById(id) as HTMLInputElement | null;
const field = (label: string) => within(card()).getByLabelText(new RegExp(`^${escapeRe(label)}`)) as HTMLInputElement;
const saveButton = () => within(card()).getByRole('button', { name: T.save });
const changeButton = () => within(card()).getByRole('button', { name: MT.change });

beforeEach(() => {
  verifyPassword = vi.fn(async (password: string) => password !== 'wrong');
  vi.mocked(api.server.info).mockReset().mockResolvedValue({ ...localInfo });
  vi.mocked(api.server.getSettings).mockReset().mockResolvedValue({ ...ownerSettings });
  vi.mocked(api.server.mail.get).mockReset().mockResolvedValue(mailSettingsFixture());
  vi.mocked(api.server.mail.put)
    .mockReset()
    .mockImplementation(async ({ password: _pw, smtpPassword, ...body }) =>
      configuredView({ ...body, smtpPasswordSet: !!smtpPassword || true, ready: !!body.enabled }),
    );
  vi.mocked(api.server.mail.test)
    .mockReset()
    .mockResolvedValue({ ok: true, sentTo: sampleUser.email, at: '2026-09-29T12:00:00.000Z', message: `מייל בדיקה נשלח אל ${sampleUser.email}.` });
});

describe('mail helpers', () => {
  it('recognises Gmail servers and App Passwords, and drops the spaces Google shows', () => {
    expect(isGmailHost('smtp.gmail.com')).toBe(true);
    expect(isGmailHost(' SMTP.GMAIL.COM. ')).toBe(true);
    expect(isGmailHost('smtp.googlemail.com')).toBe(true);
    expect(isGmailHost('smtp.example.com')).toBe(false);
    expect(isGmailHost('gmail.com.evil.example')).toBe(false);
    expect(normaliseAppPassword(` ${APP_PASSWORD_SHOWN} `, 'smtp.gmail.com')).toBe(APP_PASSWORD);
    expect(normaliseAppPassword(' pass word ', 'smtp.example.com')).toBe('pass word');
    expect(isGmailAppPassword(APP_PASSWORD)).toBe(true);
    expect(isGmailAppPassword('MyNormalPassw0rd')).toBe(false);
    expect(isGmailAppPassword('abcdefghijklmno')).toBe(false);
  });

  it('accepts the SMTP hosts the server accepts (dotted names, localhost, IPv4)', () => {
    for (const ok of ['smtp.gmail.com', 'mail.example.co.il', 'localhost', '127.0.0.1', '192.168.1.20']) expect(isValidMailHost(ok), ok).toBe(true);
    for (const bad of ['', 'mailserver', 'not a host', '-bad.example.com', 'smtp..gmail.com', 'smtp_gmail.com']) {
      expect(isValidMailHost(bad), bad).toBe(false);
    }
    expect(normaliseMailHost(' SMTP.Gmail.COM. ')).toBe('smtp.gmail.com');
  });

  it('counts the settings as configured once the address and an App Password are saved', () => {
    expect(isMailConfigured(mailSettingsFixture())).toBe(false);
    expect(isMailConfigured(mailSettingsFixture({ username: DEFAULT_MAIL_ADDRESS }))).toBe(false);
    expect(isMailConfigured(mailSettingsFixture({ smtpPasswordSet: true }))).toBe(false);
    expect(isMailConfigured(configuredView())).toBe(true);
    expect(isMailConfigured(configuredView({ enabled: false }))).toBe(true);
  });
});

describe('MT (e-mail card texts)', () => {
  function values(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const name of Object.getOwnPropertyNames(MT)) {
      const desc = Object.getOwnPropertyDescriptor(MT, name);
      if (desc?.get) out[name] = (MT as unknown as Record<string, string>)[name];
    }
    out.securityTls = MT.securityLabel('tls');
    out.securityStarttls = MT.securityLabel('starttls');
    out.serverValue = MT.serverValue('smtp.gmail.com', 465, 'tls');
    out.testHint = MT.testHint('dana@example.com');
    out.testSent = MT.testSent('dana@example.com');
    out.testFailed = MT.testFailed('boom');
    out.instructions = MT.instructions().join('\n');
    return out;
  }

  it('resolves every text in English and in Hebrew (no raw keys, no English fallback in Hebrew)', () => {
    setCurrentLocale('en');
    const en = values();
    setCurrentLocale('he');
    const he = values();
    expect(Object.keys(en).length).toBeGreaterThan(45);
    for (const [name, text] of Object.entries(en)) {
      expect(text, name).not.toBe('');
      expect(text, name).not.toMatch(/(^|\s)settings\.mail\./);
      expect(he[name], name).not.toBe(text);
      expect(he[name], name).toMatch(/[֐-׿]/);
    }
    __resetLocaleForTests();
  });

  it('explains App Passwords and 2-Step Verification, with plain port digits', () => {
    setCurrentLocale('en');
    const steps = MT.instructions();
    expect(steps).toHaveLength(5);
    expect(steps[1]).toContain('2-Step Verification');
    expect(steps[2]).toContain('myaccount.google.com/apppasswords');
    expect(steps[3]).toContain('16-letter');
    expect(MT.whyAppPassword).toContain('refuses the normal Gmail password');
    expect(MT.serverValue('smtp.gmail.com', 465, 'tls')).toBe('smtp.gmail.com, port 465, SSL/TLS');
    expect(MT.serverValue('smtp.example.com', 587, 'starttls')).toBe('smtp.example.com, port 587, STARTTLS');
    setCurrentLocale('he');
    expect(MT.title).toBe('דואר אלקטרוני לאיפוס סיסמה');
    expect(MT.instructions()[1]).toContain('אימות דו-שלבי');
    expect(MT.instructions()[3]).toContain(T.save);
    __resetLocaleForTests();
  });
});

describe('MailSection: who sees it', () => {
  it('stays hidden when the page is not opened on the computer itself', async () => {
    vi.mocked(api.server.info).mockResolvedValue({ ...localInfo, isLocalRequest: false });
    renderCard();
    await waitFor(() => expect(api.server.info).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('heading', { name: MT.title })).not.toBeInTheDocument();
    expect(api.server.mail.get).not.toHaveBeenCalled();
    expect(api.server.getSettings).not.toHaveBeenCalled();
  });

  it('renders nothing - and never asks for the settings - for an account that does not own them (isMailOwner: false)', async () => {
    // E.g. the second account on this computer: the first account owns sending e-mail.
    vi.mocked(api.server.getSettings).mockResolvedValue({ ...ownerSettings, isMailOwner: false });
    renderCard();
    await waitFor(() => expect(api.server.getSettings).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('heading', { name: MT.title })).not.toBeInTheDocument();
    expect(byId(MAIL_ADDRESS_ID)).toBeNull();
    expect(api.server.mail.get).not.toHaveBeenCalled();
  });

  it('shows the card to the owner (isMailOwner: true), and to an older server that does not say (its 403 decides)', async () => {
    const first = renderCard();
    expect(await screen.findByRole('heading', { level: 2, name: MT.title })).toBeInTheDocument();
    expect(api.server.mail.get).toHaveBeenCalledTimes(1);
    first.unmount();
    vi.mocked(api.server.getSettings).mockResolvedValue({ port: 47321, lanEnabled: false });
    renderCard();
    expect(await screen.findByRole('heading', { level: 2, name: MT.title })).toBeInTheDocument();
    expect(api.server.mail.get).toHaveBeenCalledTimes(2);
  });

  it('renders nothing at all for an account that does not own the mail settings (403)', async () => {
    vi.mocked(api.server.mail.get).mockRejectedValue(new ApiClientError(403, { code: 'FORBIDDEN', message: 'רק החשבון שהגדיר את הדואר יכול לראות אותו.' }));
    renderCard();
    await waitFor(() => expect(api.server.mail.get).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('heading', { name: MT.title })).not.toBeInTheDocument();
    expect(screen.queryByText(/רק החשבון שהגדיר/)).not.toBeInTheDocument();
    expect(byId(MAIL_ADDRESS_ID)).toBeNull();
  });

  it('shows the error in the card when the settings cannot be loaded for another reason', async () => {
    vi.mocked(api.server.mail.get).mockRejectedValue(new ApiClientError(0, { code: 'OTHER', message: T.noServer }));
    renderCard();
    expect(await screen.findByRole('heading', { level: 2, name: MT.title })).toBeInTheDocument();
    expect(within(card()).getByText(T.noServer)).toBeInTheDocument();
  });
});

describe('MailSection: first setup', () => {
  it('shows the switch (on), the Gmail address, the App Password, the advanced server settings, the password right above Save and the instructions', async () => {
    const { user } = renderCard();
    await screen.findByRole('heading', { level: 2, name: MT.title });
    await waitFor(() => expect(byId(MAIL_ENABLED_ID)).toBeInTheDocument());
    // The owner (the first account) is fixed from the start: only this account sees the card.
    expect(within(card()).getByText(MT.ownerNote)).toBeInTheDocument();
    expect(within(card()).queryByText(MT.setupOwnerNote)).not.toBeInTheDocument();
    expect(byId(MAIL_ENABLED_ID)).toBeChecked();
    expect(byId(MAIL_ENABLED_ID)).toHaveAccessibleDescription(MT.switchHint);
    const address = field(MT.address);
    expect(address).toBe(byId(MAIL_ADDRESS_ID));
    expect(address).toHaveValue(DEFAULT_MAIL_ADDRESS);
    expect(address).toHaveAttribute('type', 'email');
    expect(address).toHaveAttribute('dir', 'ltr');
    expect(address).toHaveAccessibleDescription(MT.addressHint);
    // The App Password: a password field with a show / hide button, never prefilled.
    const app = field(MT.appPassword);
    expect(app).toBe(byId(MAIL_APP_PASSWORD_ID));
    expect(app.type).toBe('password');
    expect(app).toHaveValue('');
    expect(app).toHaveAttribute('aria-required', 'true');
    expect(app).toHaveAccessibleDescription(MT.appPasswordHint);
    const show = within(app.parentElement as HTMLElement).getByRole('button', { name: T.showPassword });
    await user.click(show);
    expect(app.type).toBe('text');
    // Advanced: Gmail's server, SSL/TLS on 465 (collapsed until opened).
    const details = within(card()).getByText(MT.advanced).closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(byId(MAIL_HOST_ID)).toHaveValue('smtp.gmail.com');
    expect(byId(MAIL_PORT_ID)).toHaveValue(465);
    expect(byId(MAIL_SECURITY_ID)).toHaveValue('tls');
    // The account password, right above Save.
    const pw = field(MT.password);
    expect(pw).toBe(byId(MAIL_PASSWORD_ID));
    expect(pw.type).toBe('password');
    expect(pw).toHaveAttribute('autocomplete', 'current-password');
    expect(pw).toHaveAccessibleDescription(MT.passwordHint);
    const form = pw.closest('form') as HTMLFormElement;
    const controls = Array.from(form.querySelectorAll('input, button[type="submit"]'));
    expect(controls.indexOf(saveButton())).toBe(controls.indexOf(pw) + 1);
    // Not configured: no lock, no test button.
    expect(within(card()).queryByRole('button', { name: MT.change })).not.toBeInTheDocument();
    expect(within(card()).queryByRole('button', { name: MT.test })).not.toBeInTheDocument();
    // How to get an App Password - and why the normal password does not work.
    const how = within(card()).getByRole('heading', { name: MT.instructionsTitle }).closest('section') as HTMLElement;
    expect(within(how).getAllByRole('listitem').map((li) => li.textContent)).toEqual(MT.instructions());
    expect(within(how).getByText(MT.whyAppPassword)).toBeInTheDocument();
    expect(within(card()).getByText(MT.privacyNote)).toBeInTheDocument();
  });

  it('asks for the App Password and the account password, and rejects a normal Gmail password', async () => {
    const { user } = renderCard();
    await waitFor(() => expect(byId(MAIL_ADDRESS_ID)).toBeInTheDocument());
    await user.click(saveButton());
    expect(byId(MAIL_APP_PASSWORD_ID)).toHaveAttribute('aria-invalid', 'true');
    expect(byId(MAIL_APP_PASSWORD_ID)).toHaveAccessibleDescription(`${MT.appPasswordHint} ${MT.appPasswordMissing}`);
    expect(byId(MAIL_APP_PASSWORD_ID)).toHaveFocus();
    expect(byId(MAIL_PASSWORD_ID)).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(2)));
    expect(api.server.mail.put).not.toHaveBeenCalled();

    await user.type(byId(MAIL_APP_PASSWORD_ID) as HTMLInputElement, 'MyNormalGmailPassw0rd');
    await user.type(byId(MAIL_PASSWORD_ID) as HTMLInputElement, PASSWORD);
    await user.click(saveButton());
    expect(byId(MAIL_APP_PASSWORD_ID)).toHaveAccessibleDescription(`${MT.appPasswordHint} ${MT.appPasswordGmail}`);
    expect(api.server.mail.put).not.toHaveBeenCalled();
  });

  it('opens "Advanced" and focuses the server field when it is invalid; checks the address shape', async () => {
    const { user } = renderCard();
    await waitFor(() => expect(byId(MAIL_ADDRESS_ID)).toBeInTheDocument());
    const address = byId(MAIL_ADDRESS_ID) as HTMLInputElement;
    await user.clear(address);
    await user.type(address, 'not-an-address');
    await user.click(within(card()).getByText(MT.advanced));
    await user.clear(byId(MAIL_HOST_ID) as HTMLInputElement);
    await user.type(byId(MAIL_HOST_ID) as HTMLInputElement, 'not a host');
    await user.click(within(card()).getByText(MT.advanced)); // collapse again
    await user.type(byId(MAIL_APP_PASSWORD_ID) as HTMLInputElement, APP_PASSWORD_SHOWN);
    await user.type(byId(MAIL_PASSWORD_ID) as HTMLInputElement, PASSWORD);
    await user.click(saveButton());
    expect(address).toHaveAccessibleDescription(`${MT.addressHint} ${MT.addressInvalid}`);
    expect(address).toHaveFocus();
    await user.clear(address);
    await user.type(address, DEFAULT_MAIL_ADDRESS);
    await user.click(saveButton());
    const details = within(card()).getByText(MT.advanced).closest('details') as HTMLDetailsElement;
    await waitFor(() => expect(details.open).toBe(true));
    await waitFor(() => expect(byId(MAIL_HOST_ID)).toHaveFocus());
    expect(byId(MAIL_HOST_ID)).toHaveAccessibleDescription(`${MT.hostHint} ${MT.hostInvalid}`);
    expect(api.server.mail.put).not.toHaveBeenCalled();
  });

  it('moves a default port along with the connection security', async () => {
    const { user } = renderCard();
    await waitFor(() => expect(byId(MAIL_SECURITY_ID)).toBeInTheDocument());
    await user.click(within(card()).getByText(MT.advanced));
    await user.selectOptions(byId(MAIL_SECURITY_ID) as unknown as HTMLSelectElement, 'starttls');
    expect(byId(MAIL_PORT_ID)).toHaveValue(587);
    await user.selectOptions(byId(MAIL_SECURITY_ID) as unknown as HTMLSelectElement, 'tls');
    expect(byId(MAIL_PORT_ID)).toHaveValue(465);
    // A custom port stays.
    await user.clear(byId(MAIL_PORT_ID) as HTMLInputElement);
    await user.type(byId(MAIL_PORT_ID) as HTMLInputElement, '2525');
    await user.selectOptions(byId(MAIL_SECURITY_ID) as unknown as HTMLSelectElement, 'starttls');
    expect(byId(MAIL_PORT_ID)).toHaveValue(2525);
  });

  it('saves with the account password (App Password without spaces, address as sender), announces and locks the card', async () => {
    const { user } = renderCard();
    await waitFor(() => expect(byId(MAIL_ADDRESS_ID)).toBeInTheDocument());
    await user.type(byId(MAIL_APP_PASSWORD_ID) as HTMLInputElement, APP_PASSWORD_SHOWN);
    await user.type(byId(MAIL_PASSWORD_ID) as HTMLInputElement, PASSWORD);
    await user.click(saveButton());
    await waitFor(() =>
      expect(api.server.mail.put).toHaveBeenCalledWith({
        enabled: true,
        host: 'smtp.gmail.com',
        port: 465,
        security: 'tls',
        username: DEFAULT_MAIL_ADDRESS,
        fromAddress: DEFAULT_MAIL_ADDRESS,
        smtpPassword: APP_PASSWORD,
        password: PASSWORD,
      }),
    );
    await waitFor(() => expect(politeRegion()).toHaveTextContent(MT.enabled));
    // Locked now: no form, the summary, focus on "Change settings".
    expect(byId(MAIL_ADDRESS_ID)).toBeNull();
    expect(byId(MAIL_APP_PASSWORD_ID)).toBeNull();
    await waitFor(() => expect(changeButton()).toHaveFocus());
    const current = within(card()).getByRole('heading', { name: MT.currentTitle }).closest('section') as HTMLElement;
    for (const text of [MT.summaryState, MT.summaryOn, MT.summaryAddress, DEFAULT_MAIL_ADDRESS, MT.summaryAppPassword, MT.summaryAppPasswordSaved, MT.serverValue('smtp.gmail.com', 465, 'tls')]) {
      expect(current).toHaveTextContent(text);
    }
    // The App Password itself is never shown.
    expect(card()).not.toHaveTextContent(APP_PASSWORD);
    expect(within(card()).getByText(MT.ownerNote)).toBeInTheDocument();
  });

  it('shows a wrong account password at its field and keeps what was typed', async () => {
    vi.mocked(api.server.mail.put).mockRejectedValue(new ApiClientError(400, { code: 'WRONG_PASSWORD', field: 'password', message: 'הסיסמה שגויה.' }));
    const { user } = renderCard();
    await waitFor(() => expect(byId(MAIL_ADDRESS_ID)).toBeInTheDocument());
    await user.type(byId(MAIL_APP_PASSWORD_ID) as HTMLInputElement, APP_PASSWORD);
    await user.type(byId(MAIL_PASSWORD_ID) as HTMLInputElement, 'wrong');
    await user.click(saveButton());
    await waitFor(() => expect(byId(MAIL_PASSWORD_ID)).toHaveAttribute('aria-invalid', 'true'));
    expect(byId(MAIL_PASSWORD_ID)).toHaveAccessibleDescription(`${MT.passwordHint} ${MT.wrongPassword}`);
    expect(byId(MAIL_PASSWORD_ID)).toHaveFocus();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(MT.wrongPassword));
    expect(byId(MAIL_APP_PASSWORD_ID)).toHaveValue(APP_PASSWORD);
  });

  it('shows a server validation error at the matching field', async () => {
    vi.mocked(api.server.mail.put).mockRejectedValue(new ApiClientError(400, { code: 'VALIDATION', field: 'username', message: 'כתובת לא תקינה' }));
    const { user } = renderCard();
    await waitFor(() => expect(byId(MAIL_ADDRESS_ID)).toBeInTheDocument());
    await user.type(byId(MAIL_APP_PASSWORD_ID) as HTMLInputElement, APP_PASSWORD);
    await user.type(byId(MAIL_PASSWORD_ID) as HTMLInputElement, PASSWORD);
    await user.click(saveButton());
    await waitFor(() => expect(byId(MAIL_ADDRESS_ID)).toHaveAttribute('aria-invalid', 'true'));
    expect(byId(MAIL_ADDRESS_ID)).toHaveAccessibleDescription(`${MT.addressHint} כתובת לא תקינה`);
  });
});

describe('MailSection: locked once configured', () => {
  it('shows the summary, "Send test e-mail" with the own address, and "Change settings" instead of fields', async () => {
    vi.mocked(api.server.mail.get).mockResolvedValue(configuredView());
    const { user } = renderCard();
    const current = (await screen.findByRole('heading', { name: MT.currentTitle })).closest('section') as HTMLElement;
    for (const id of [MAIL_ADDRESS_ID, MAIL_APP_PASSWORD_ID, MAIL_ENABLED_ID, MAIL_PASSWORD_ID]) expect(byId(id)).toBeNull();
    expect(within(card()).queryByRole('button', { name: T.save })).not.toBeInTheDocument();
    expect(within(current).getByText(MT.lockedHint)).toBeInTheDocument();
    expect(within(current).getByText(MT.testHint(sampleUser.email))).toBeInTheDocument();

    await user.click(within(current).getByRole('button', { name: MT.test }));
    await waitFor(() => expect(api.server.mail.test).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(`מייל בדיקה נשלח אל ${sampleUser.email}.`));
    expect(within(card()).getByText(`מייל בדיקה נשלח אל ${sampleUser.email}.`)).toBeInTheDocument();
  });

  it('reports a failed test e-mail with the server reason (e.g. the Gmail App Password hint)', async () => {
    vi.mocked(api.server.mail.get).mockResolvedValue(configuredView());
    vi.mocked(api.server.mail.test).mockRejectedValue(
      new ApiClientError(502, { code: 'OTHER', message: 'Gmail דחה את הכניסה. יש להשתמש בסיסמת אפליקציה.' }),
    );
    const { user } = renderCard();
    await user.click(await screen.findByRole('button', { name: MT.test }));
    const expected = MT.testFailed('Gmail דחה את הכניסה. יש להשתמש בסיסמת אפליקציה.');
    await waitFor(() => expect(within(card()).getByText(expected).closest('.alert--error')).not.toBeNull());
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(expected));
    // One announcement channel: the visible box is not a second alert.
    expect(within(card()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('while off: the summary says so and there is no test button; no own address: says how to add one', async () => {
    vi.mocked(api.server.mail.get).mockResolvedValue(configuredView({ enabled: false, ready: false }));
    const first = renderCard();
    const current = (await screen.findByRole('heading', { name: MT.currentTitle })).closest('section') as HTMLElement;
    expect(current).toHaveTextContent(MT.summaryOff);
    expect(within(card()).queryByRole('button', { name: MT.test })).not.toBeInTheDocument();
    first.unmount();

    vi.mocked(api.server.mail.get).mockResolvedValue(configuredView());
    renderCard({ ...sampleUser, email: '' });
    expect(await screen.findByText(MT.testNoEmail)).toBeInTheDocument();
  });

  it('warns when it is on but the details are incomplete', async () => {
    vi.mocked(api.server.mail.get).mockResolvedValue(configuredView({ ready: false }));
    renderCard();
    expect(await screen.findByText(MT.notReady)).toBeInTheDocument();
    expect(within(card()).queryByRole('button', { name: MT.test })).not.toBeInTheDocument();
  });

  it('"Change settings" asks for the password first; Save keeps the saved App Password and locks again', async () => {
    vi.mocked(api.server.mail.get).mockResolvedValue(configuredView());
    const { user } = renderCard();
    await user.click(await screen.findByRole('button', { name: MT.change }));
    const dialog = await screen.findByRole('dialog', { name: MT.unlockTitle });
    expect(dialog).toHaveTextContent(MT.unlockMessage);
    const pw = within(dialog).getByLabelText(new RegExp(`^${T.password}`)) as HTMLInputElement;
    await user.type(pw, 'wrong');
    await user.click(within(dialog).getByRole('button', { name: T.confirm }));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(MT.wrongPassword));
    expect(byId(MAIL_ADDRESS_ID)).toBeNull();
    await user.clear(pw);
    await user.type(pw, `${PASSWORD}{Enter}`);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(byId(MAIL_ADDRESS_ID)).toHaveFocus());
    await waitFor(() => expect(politeRegion()).toHaveTextContent(MT.unlocked));
    expect(byId(MAIL_ADDRESS_ID)).toHaveValue(DEFAULT_MAIL_ADDRESS);
    expect(byId(MAIL_APP_PASSWORD_ID)).toHaveValue('');
    expect(byId(MAIL_APP_PASSWORD_ID)).not.toHaveAttribute('aria-required');
    expect(byId(MAIL_APP_PASSWORD_ID)).toHaveAccessibleDescription(MT.appPasswordSaved);
    expect(byId(MAIL_PASSWORD_ID)).toBeNull();
    expect(byId(MAIL_ENABLED_ID)).toBeChecked();

    await user.click(byId(MAIL_ENABLED_ID) as HTMLInputElement);
    await user.click(saveButton());
    await waitFor(() =>
      expect(api.server.mail.put).toHaveBeenCalledWith({
        enabled: false,
        host: 'smtp.gmail.com',
        port: 465,
        security: 'tls',
        username: DEFAULT_MAIL_ADDRESS,
        fromAddress: DEFAULT_MAIL_ADDRESS,
        password: PASSWORD,
      }),
    );
    await waitFor(() => expect(politeRegion()).toHaveTextContent(MT.disabled));
    await waitFor(() => expect(byId(MAIL_CHANGE_BUTTON_ID)).toHaveFocus());
    expect(byId(MAIL_ADDRESS_ID)).toBeNull();
  });

  it('Cancel in the form changes nothing and locks again; locking the app closes an open form', async () => {
    vi.mocked(api.server.mail.get).mockResolvedValue(configuredView());
    const { user } = renderCard();
    await user.click(await screen.findByRole('button', { name: MT.change }));
    let dialog = await screen.findByRole('dialog', { name: MT.unlockTitle });
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), `${PASSWORD}{Enter}`);
    await waitFor(() => expect(byId(MAIL_ADDRESS_ID)).toHaveFocus());
    await user.clear(byId(MAIL_ADDRESS_ID) as HTMLInputElement);
    await user.type(byId(MAIL_ADDRESS_ID) as HTMLInputElement, 'other@example.com');
    await user.click(within(card()).getByRole('button', { name: T.cancel }));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(MT.editCancelled));
    expect(byId(MAIL_ADDRESS_ID)).toBeNull();
    await waitFor(() => expect(changeButton()).toHaveFocus());
    expect(api.server.mail.put).not.toHaveBeenCalled();

    await user.click(changeButton());
    dialog = await screen.findByRole('dialog', { name: MT.unlockTitle });
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), `${PASSWORD}{Enter}`);
    await waitFor(() => expect(byId(MAIL_ADDRESS_ID)).toHaveValue(DEFAULT_MAIL_ADDRESS));
    act(() => lockApp());
    await waitFor(() => expect(byId(MAIL_ADDRESS_ID)).toBeNull());
    expect(changeButton()).toBeInTheDocument();
  });

  it('asks for the password again when it changed since the form was unlocked, keeping the edits', async () => {
    vi.mocked(api.server.mail.get).mockResolvedValue(configuredView());
    vi.mocked(api.server.mail.put).mockRejectedValueOnce(new ApiClientError(400, { code: 'WRONG_PASSWORD', field: 'password', message: 'x' }));
    const { user } = renderCard();
    await user.click(await screen.findByRole('button', { name: MT.change }));
    let dialog = await screen.findByRole('dialog', { name: MT.unlockTitle });
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), `${PASSWORD}{Enter}`);
    await waitFor(() => expect(byId(MAIL_ADDRESS_ID)).toHaveFocus());
    await user.type(byId(MAIL_APP_PASSWORD_ID) as HTMLInputElement, APP_PASSWORD);
    await user.click(saveButton());
    dialog = await screen.findByRole('dialog', { name: MT.unlockTitle });
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(MT.wrongPassword));
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), 'N3w-Passw0rd!{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(byId(MAIL_APP_PASSWORD_ID)).toHaveValue(APP_PASSWORD);
    await user.click(saveButton());
    await waitFor(() =>
      expect(api.server.mail.put).toHaveBeenLastCalledWith(expect.objectContaining({ smtpPassword: APP_PASSWORD, password: 'N3w-Passw0rd!' })),
    );
  });
});
