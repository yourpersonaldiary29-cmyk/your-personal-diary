/**
 * Remote access card: shown only on the computer itself and only to the account
 * that owns remote access - the first account (`isRemoteOwner` in the server
 * settings; another account sees nothing and the card never even asks for the
 * status; a 403 hides it too); the
 * first setup (connection details, the on/off switch, the account password right
 * above Save) and its validation; the locked card once configured (summary,
 * test, renewal, steps with icon + words polled while busy, certificate,
 * address with copy button and QR code) and "Change settings", which asks for
 * the password in a dialog before the form opens; the manual port-forwarding
 * instructions - and the Privacy card's confirmation (with the password) before
 * offline privacy mode turns remote access off.
 */
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { AppSettings, RemoteStatus, ServerInfo, ServerSettings } from '@shared/types';
import * as api from '@/api';
import { ApiClientError, getOfflinePrivacyMode, setOfflinePrivacyMode } from '@/api';
import { DEFAULT_APP_SETTINGS } from '@/constants/settings';
import { T } from '@/constants/texts';
import { LockContext } from '@/context/LockContext';
import { SettingsContext, type SettingsContextValue } from '@/context/SettingsContext';
import { __resetLocaleForTests, setCurrentLocale, tr } from '@/i18n/runtime';
import { remoteStatusFixture } from '@/test/api-mock';
import { assertiveRegion, politeRegion, renderWithProviders } from '@/test/render';
import { formatLongDate } from '@/utils/dates';
import { encodeQr, qrSvgPath } from '@/utils/qr';
import { PrivacySection } from './PrivacySection';
import {
  REMOTE_ACCESS_CHECKBOX_ID,
  REMOTE_HOSTNAME_ID,
  REMOTE_PASSWORD_ID,
  REMOTE_POLL_BUSY_MS,
  RemoteAccessSection,
  isRemoteConfigured,
  isValidDuckDnsToken,
  isValidRemoteHostname,
  normaliseRemoteHostname,
} from './RemoteAccessSection';
import { getRemoteStatus, publishRemoteStatus } from './remoteAccessStore';
import { DEFAULT_REMOTE_HOSTNAME, RT, remoteMessage } from './remoteTexts';
import { ST } from './texts';

vi.mock('@/api', async (importOriginal) => {
  const { createApiMock } = await import('@/test/api-mock');
  return createApiMock(await importOriginal());
});

const TOKEN = 'a1b2c3d4-e5f6-4789-abcd-0123456789ef';
const HOST = DEFAULT_REMOTE_HOSTNAME;
const URL = `https://${HOST}`;
const PASSWORD = 'Passw0rd!';
const NEW_PASSWORD = 'N3w-Passw0rd!';

const localInfo: ServerInfo = {
  version: '0.1.0',
  port: 47321,
  lanEnabled: false,
  lanUrls: [],
  dataDir: 'C:\\data',
  isLocalRequest: true,
  startedAt: '2026-09-28T08:00:00.000Z',
};

/** GET /api/server/settings of the owner (the first account on this computer). */
const ownerSettings: ServerSettings = { port: 47321, lanEnabled: false, isRemoteOwner: true, isMailOwner: true };

/** A running / finished remote-access status, owned by the signed-in account. */
function enabledStatus(overrides: Partial<RemoteStatus> = {}): RemoteStatus {
  return remoteStatusFixture({
    enabled: true,
    hostname: HOST,
    tokenSet: true,
    publicIp: '203.0.113.7',
    certificate: { validTo: '2026-12-20T10:00:00.000Z', issuer: "Let's Encrypt R11", daysLeft: 83, staging: false },
    steps: [
      { id: 'duckdns', state: 'ok', messageKey: '', params: {}, at: '2026-09-28T09:00:00.000Z' },
      { id: 'certificate', state: 'ok', messageKey: '', params: {}, at: '2026-09-28T09:01:30.000Z' },
      { id: 'listener', state: 'ok', messageKey: '', params: {}, at: '2026-09-28T09:01:31.000Z' },
      { id: 'upnp', state: 'ok', messageKey: '', params: {}, at: '2026-09-28T09:01:32.000Z' },
    ],
    urls: [URL],
    tlsPort: 443,
    lanIps: ['192.168.1.20'],
    hasOwner: true,
    ...overrides,
  });
}

/** Settings provider with real state, so the Privacy card's checkbox follows `update`. */
let updateSpy: Mock<(patch: Partial<AppSettings>) => void>;
function StatefulSettings({ initial, children }: { initial: Partial<AppSettings>; children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_APP_SETTINGS, ...initial });
  const value: SettingsContextValue = {
    settings,
    loaded: true,
    error: null,
    update: async (patch) => {
      updateSpy(patch);
      let next = settings;
      setSettings((s) => (next = { ...s, ...patch }));
      return next;
    },
    reload: async () => undefined,
  };
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** The account password check behind "Change settings" (AuthContext.verifyPassword). */
let verifyPassword: Mock<(password: string) => Promise<boolean>>;

function renderCard(settings: Partial<AppSettings> = {}, withPrivacy = false) {
  return renderWithProviders(
    <StatefulSettings initial={settings}>
      {withPrivacy && <PrivacySection />}
      <RemoteAccessSection />
    </StatefulSettings>,
    { auth: 'authenticated', authOverrides: { verifyPassword } },
  );
}

const escapeRe = (s: string) => s.replace(/[()]/g, '\\$&');
const card = () => screen.getByRole('heading', { level: 2, name: RT.title }).closest('section') as HTMLElement;
const remoteSwitch = () => document.getElementById(REMOTE_ACCESS_CHECKBOX_ID) as HTMLInputElement;
const field = (label: string) => within(card()).getByLabelText(new RegExp(`^${escapeRe(label)}`));
const passwordField = () => field(RT.password);
const saveButton = () => within(card()).getByRole('button', { name: T.save });
const changeButton = () => within(card()).getByRole('button', { name: RT.change });
const upnpBox = () => within(card()).getByRole('checkbox', { name: new RegExp(`^${escapeRe(RT.upnp)}`) });

beforeEach(() => {
  updateSpy = vi.fn();
  verifyPassword = vi.fn(async (password: string) => password !== 'wrong');
  publishRemoteStatus(null);
  setOfflinePrivacyMode(true);
  vi.mocked(api.server.info).mockReset().mockResolvedValue({ ...localInfo });
  vi.mocked(api.server.getSettings).mockReset().mockResolvedValue({ ...ownerSettings });
  vi.mocked(api.server.remote.get).mockReset().mockResolvedValue(remoteStatusFixture());
  vi.mocked(api.server.remote.put)
    .mockReset()
    .mockImplementation(async (body) =>
      body.enabled
        ? enabledStatus({ busy: true, urls: [], certificate: null, steps: remoteStatusFixture().steps.map((s) => ({ ...s, state: 'running' as const })) })
        : remoteStatusFixture({
            hostname: body.hostname ?? '',
            publicPort: body.publicPort ?? 443,
            upnp: body.upnp ?? true,
            tokenSet: !!body.duckdnsToken,
            hasOwner: true,
          }),
    );
  vi.mocked(api.server.remote.renew).mockReset().mockResolvedValue(enabledStatus({ busy: true }));
  vi.mocked(api.server.remote.test).mockReset();
});

afterEach(() => {
  publishRemoteStatus(null);
});

describe('remote access helpers', () => {
  it('normalises what the user types into a DuckDNS host name', () => {
    expect(normaliseRemoteHostname('  https://YourPersonalDiary.DuckDNS.org/login ')).toBe(HOST);
    expect(normaliseRemoteHostname('yourpersonaldiary')).toBe(HOST);
    expect(normaliseRemoteHostname('yourpersonaldiary.duckdns.org:443')).toBe(HOST);
    expect(normaliseRemoteHostname('yourpersonaldiary.duckdns.org.')).toBe(HOST);
    expect(normaliseRemoteHostname('')).toBe('');
  });

  it('accepts only <name>.duckdns.org and 8-4-4-4-12 hexadecimal tokens', () => {
    expect(isValidRemoteHostname(HOST)).toBe(true);
    expect(isValidRemoteHostname('my-diary-2.duckdns.org')).toBe(true);
    expect(isValidRemoteHostname('example.com')).toBe(false);
    expect(isValidRemoteHostname('-bad.duckdns.org')).toBe(false);
    expect(isValidRemoteHostname('a.b.duckdns.org')).toBe(false);
    expect(isValidDuckDnsToken(TOKEN)).toBe(true);
    expect(isValidDuckDnsToken(TOKEN.toUpperCase())).toBe(true);
    expect(isValidDuckDnsToken('not-a-token')).toBe(false);
    expect(isValidDuckDnsToken(TOKEN.replace('a', 'g'))).toBe(false);
  });

  it('counts remote access as configured once a token is saved and a certificate exists or it is on', () => {
    expect(isRemoteConfigured(remoteStatusFixture())).toBe(false);
    expect(isRemoteConfigured(remoteStatusFixture({ tokenSet: true }))).toBe(false);
    expect(isRemoteConfigured(remoteStatusFixture({ enabled: true }))).toBe(false);
    expect(isRemoteConfigured(enabledStatus())).toBe(true);
    expect(isRemoteConfigured(enabledStatus({ enabled: false }))).toBe(true);
    expect(isRemoteConfigured(enabledStatus({ certificate: null }))).toBe(true);
  });

  it('renders server messages in the UI language and falls back for unknown keys', () => {
    setCurrentLocale('en');
    expect(remoteMessage({ messageKey: 'settings.remote.ready', params: { url: URL } }, 'x')).toBe(`Remote access is ready. Your diary's address: ${URL}`);
    expect(remoteMessage({ messageKey: 'server.remote.somethingNew', params: {} }, 'fallback')).toBe('fallback');
    expect(remoteMessage({ messageKey: '', params: {} }, 'fallback')).toBe('fallback');
    expect(remoteMessage(null, 'fallback')).toBe('fallback');
    // The certificate date comes as YYYY-MM-DD and is shown as a date in the UI language.
    const ok = remoteMessage({ messageKey: 'server.remote.step.certificate.ok', params: { date: '2026-12-29', days: 90 } }, 'x');
    expect(ok).not.toContain('2026-12-29');
    expect(ok).toContain(formatLongDate('2026-12-29'));
    // A detail the server sends as a catalogue key is shown in the UI language too.
    const failed = remoteMessage({ messageKey: 'server.remote.step.duckdns.failed', params: { detail: 'server.remote.detail.timeout', seconds: 10 } }, 'x');
    expect(failed).not.toContain('server.remote.detail');
    expect(failed).toContain(tr('server.remote.detail.timeout', { seconds: 10 }));
    __resetLocaleForTests();
  });
});

describe('RT (remote access texts)', () => {
  afterEach(() => __resetLocaleForTests());

  function values(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const name of Object.getOwnPropertyNames(RT)) {
      const desc = Object.getOwnPropertyDescriptor(RT, name);
      if (desc?.get) out[name] = (RT as unknown as Record<string, string>)[name];
    }
    out.testDone = RT.testDone(3, 4);
    out.ready = RT.ready(URL);
    out.failed = RT.failed('boom');
    out.certificateValid = RT.certificateValid('20 December 2026', 83, 'R11');
    out.instructions = RT.instructions(443, 8443, '192.168.1.20').join('\n');
    out.instructionsNoIp = RT.instructions(443, 443, null).join('\n');
    for (const s of ['idle', 'running', 'ok', 'error', 'warning', 'skipped'] as const) out[`state.${s}`] = RT.stateLabel(s);
    for (const s of ['duckdns', 'certificate', 'listener', 'upnp'] as const) out[`step.${s}`] = RT.stepName(s);
    for (const s of ['duckdns', 'upnp', 'dns', 'https'] as const) out[`check.${s}`] = RT.checkName(s);
    return out;
  }

  it('resolves every text in English and in Hebrew (no raw keys, no English fallback in Hebrew)', () => {
    setCurrentLocale('en');
    const en = values();
    setCurrentLocale('he');
    const he = values();
    expect(Object.keys(en).length).toBeGreaterThan(70);
    for (const [name, text] of Object.entries(en)) {
      expect(text, name).not.toBe('');
      expect(text, name).not.toMatch(/(^|\s)settings\.remote\./);
      expect(he[name], name).not.toBe(text);
      expect(he[name], name).toMatch(/[֐-׿]/);
    }
  });

  it('writes ports as plain digits and uses plural forms', () => {
    setCurrentLocale('en');
    const steps = RT.instructions(443, 8443, '192.168.1.20');
    expect(steps).toHaveLength(8);
    expect(steps[1]).toContain('type your account password and select Save');
    expect(steps[5]).toContain('Windows Firewall');
    expect(steps[7]).toContain('Phone access on the home network');
    expect(steps[4]).toContain('forward external port 443 (TCP)');
    expect(steps[4]).toContain('192.168.1.20, port 8443.');
    expect(RT.certificateValid('20 December 2026', 1, 'R11')).toContain('(1 day left)');
    expect(RT.certificateValid('20 December 2026', 83, 'R11')).toContain('(83 days left)');
    expect(RT.testDone(3, 4)).toBe('Connection test finished: 3 of 4 checks passed.');
    setCurrentLocale('he');
    expect(RT.title).toBe('גישה מרחוק');
    expect(RT.certificateValid('20 בדצמבר 2026', 2, 'R11')).toContain('נותרו יומיים');
    expect(RT.instructions(443, 8443, '192.168.1.20')[4]).toContain('פורט 8443');
    expect(RT.instructions(443, 8443, '192.168.1.20')[1]).toContain(T.save);
  });
});

describe('RemoteAccessSection: who sees it', () => {
  it('stays hidden when the page is not opened on the computer itself', async () => {
    vi.mocked(api.server.info).mockResolvedValue({ ...localInfo, isLocalRequest: false });
    renderCard();
    await waitFor(() => expect(api.server.info).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('heading', { name: RT.title })).not.toBeInTheDocument();
    expect(api.server.remote.get).not.toHaveBeenCalled();
    expect(api.server.getSettings).not.toHaveBeenCalled();
  });

  it('renders nothing - and never asks for the status - for an account that does not own remote access (isRemoteOwner: false)', async () => {
    // E.g. the second account on this computer: the first account owns remote access.
    publishRemoteStatus(enabledStatus());
    vi.mocked(api.server.getSettings).mockResolvedValue({ ...ownerSettings, isRemoteOwner: false });
    renderCard();
    await waitFor(() => expect(api.server.getSettings).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('heading', { name: RT.title })).not.toBeInTheDocument();
    expect(document.getElementById(REMOTE_HOSTNAME_ID)).toBeNull();
    expect(screen.queryByText(HOST)).not.toBeInTheDocument();
    expect(api.server.remote.get).not.toHaveBeenCalled();
    // A status left in the shared store by the owner's earlier visit is not this account's (nor the Privacy card's).
    expect(getRemoteStatus()).toBeNull();
  });

  it('shows the card to the owner (isRemoteOwner: true)', async () => {
    renderCard();
    expect(await screen.findByRole('heading', { level: 2, name: RT.title })).toBeInTheDocument();
    expect(api.server.remote.get).toHaveBeenCalledTimes(1);
  });

  it('asks for the status when the server settings do not report the owner (older server) or cannot be loaded', async () => {
    vi.mocked(api.server.getSettings).mockResolvedValue({ port: 47321, lanEnabled: false });
    const first = renderCard();
    expect(await screen.findByRole('heading', { level: 2, name: RT.title })).toBeInTheDocument();
    first.unmount();
    vi.mocked(api.server.getSettings).mockRejectedValue(new ApiClientError(0, { code: 'OTHER', message: T.noServer }));
    vi.mocked(api.server.remote.get).mockRejectedValue(new ApiClientError(403, { code: 'FORBIDDEN', message: 'x' }));
    renderCard();
    await waitFor(() => expect(api.server.remote.get).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('heading', { name: RT.title })).not.toBeInTheDocument();
  });

  it('renders nothing at all for an account that does not own remote access (403)', async () => {
    vi.mocked(api.server.remote.get).mockRejectedValue(
      new ApiClientError(403, { code: 'FORBIDDEN', message: 'רק החשבון שהגדיר את הגישה מרחוק יכול לראות או לשנות אותה.' }),
    );
    renderCard();
    await waitFor(() => expect(api.server.remote.get).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('heading', { name: RT.title })).not.toBeInTheDocument();
    expect(screen.queryByText(/רק החשבון שהגדיר/)).not.toBeInTheDocument();
    expect(document.getElementById(REMOTE_HOSTNAME_ID)).toBeNull();
    expect(getRemoteStatus()).toBeNull();
  });

  it('never shows a status left in the shared store by an earlier visit (another account), and a 403 clears it', async () => {
    // E.g. the owner's save finished after the owner signed out; now another account opens Settings.
    publishRemoteStatus(enabledStatus());
    let refuse: (e: unknown) => void = () => {};
    vi.mocked(api.server.remote.get).mockReturnValue(
      new Promise((_resolve, reject) => {
        refuse = reject;
      }),
    );
    renderCard();
    await waitFor(() => expect(api.server.remote.get).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    // While the server has not answered this card's own request: nothing, no fields, no name.
    expect(screen.queryByRole('heading', { name: RT.title })).not.toBeInTheDocument();
    expect(document.getElementById(REMOTE_HOSTNAME_ID)).toBeNull();
    expect(screen.queryByText(HOST)).not.toBeInTheDocument();
    refuse(new ApiClientError(403, { code: 'FORBIDDEN', message: 'x' }));
    await waitFor(() => expect(getRemoteStatus()).toBeNull());
    expect(screen.queryByRole('heading', { name: RT.title })).not.toBeInTheDocument();
  });

  it('shows the error in the card when the status cannot be loaded for another reason', async () => {
    vi.mocked(api.server.remote.get).mockRejectedValue(new ApiClientError(0, { code: 'OTHER', message: T.noServer }));
    renderCard();
    expect(await screen.findByRole('heading', { level: 2, name: RT.title })).toBeInTheDocument();
    expect(within(card()).getByText(T.noServer)).toBeInTheDocument();
  });
});

describe('RemoteAccessSection: first setup', () => {
  it('shows the details, the switch off, the write-only token field, the password right above Save and the instructions', async () => {
    const { user } = renderCard();
    await screen.findByRole('heading', { level: 2, name: RT.title });
    await waitFor(() => expect(remoteSwitch()).toBeInTheDocument());
    // The owner (the first account) is fixed from the start: only this account sees the card.
    expect(within(card()).getByText(RT.ownerNote)).toBeInTheDocument();
    expect(within(card()).queryByText(RT.setupOwnerNote)).not.toBeInTheDocument();
    expect(remoteSwitch()).not.toBeChecked();
    expect(remoteSwitch()).toHaveAccessibleName(new RegExp(`^${RT.switchLabel}`));
    expect(field(RT.hostname)).toHaveValue(HOST);
    expect(field(RT.hostname)).toHaveAttribute('placeholder', HOST);
    const token = field(RT.token) as HTMLInputElement;
    expect(token.type).toBe('password');
    expect(token).toHaveAccessibleDescription(RT.tokenHint);
    const show = within(card()).getByRole('button', { name: RT.showToken });
    expect(show).toHaveAttribute('aria-pressed', 'false');
    await user.click(show);
    expect(token.type).toBe('text');
    expect(show).toHaveAttribute('aria-pressed', 'true');
    expect(field(RT.publicPort)).toHaveValue(443);
    expect(upnpBox()).toBeChecked();
    // The account password, right above Save.
    const pw = passwordField() as HTMLInputElement;
    expect(pw.type).toBe('password');
    expect(pw).toHaveAttribute('autocomplete', 'current-password');
    expect(pw).toHaveAttribute('aria-required', 'true');
    expect(pw).toHaveAccessibleDescription(RT.passwordHint);
    const form = pw.closest('form') as HTMLFormElement;
    const controls = Array.from(form.querySelectorAll('input, button[type="submit"]'));
    expect(controls.indexOf(saveButton())).toBe(controls.indexOf(pw) + 1);
    // Not configured: no lock, no status, no address, no test button.
    expect(within(card()).queryByRole('button', { name: RT.change })).not.toBeInTheDocument();
    expect(within(card()).queryByRole('heading', { name: RT.statusTitle })).not.toBeInTheDocument();
    expect(within(card()).queryByRole('button', { name: RT.test })).not.toBeInTheDocument();
    const how = within(card()).getByRole('heading', { name: RT.instructionsTitle }).closest('section') as HTMLElement;
    const steps = within(how).getAllByRole('listitem');
    expect(steps.map((li) => li.textContent)).toEqual(RT.instructions(443, 443, null));
    expect(within(card()).getByText(RT.privacyNote)).toBeInTheDocument();
    expect(getRemoteStatus()?.enabled).toBe(false);
  });

  it('asks for the token and the password before turning on, and focuses the first problem', async () => {
    const { user } = renderCard();
    await waitFor(() => expect(remoteSwitch()).toBeInTheDocument());
    await user.click(remoteSwitch());
    expect(remoteSwitch()).toBeChecked();
    expect(api.server.remote.put).not.toHaveBeenCalled();
    await user.click(saveButton());
    const token = field(RT.token);
    expect(token).toHaveAttribute('aria-invalid', 'true');
    expect(token).toHaveAccessibleDescription(`${RT.tokenHint} ${RT.tokenMissing}`);
    expect(token).toHaveFocus();
    expect(passwordField()).toHaveAttribute('aria-invalid', 'true');
    expect(within(card()).getByText(RT.passwordMissing)).toBeInTheDocument();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(2)));
    expect(api.server.remote.put).not.toHaveBeenCalled();

    await user.type(token, 'nonsense');
    await user.type(passwordField(), PASSWORD);
    expect(passwordField()).not.toHaveAttribute('aria-invalid');
    await user.click(saveButton());
    expect(within(card()).getByText(RT.tokenInvalid)).toBeInTheDocument();
    expect(api.server.remote.put).not.toHaveBeenCalled();
  });

  it('turns remote access on with the password, turns offline privacy mode off (announced) and locks the card', async () => {
    const { user } = renderCard({ offlinePrivacyMode: true });
    await waitFor(() => expect(remoteSwitch()).toBeInTheDocument());
    await user.type(field(RT.token), TOKEN);
    await user.click(remoteSwitch());
    await user.type(passwordField(), PASSWORD);
    await user.click(saveButton());

    await waitFor(() =>
      expect(api.server.remote.put).toHaveBeenCalledWith({
        hostname: HOST,
        publicPort: 443,
        upnp: true,
        enabled: true,
        duckdnsToken: TOKEN,
        password: PASSWORD,
      }),
    );
    expect(updateSpy).toHaveBeenCalledWith({ offlinePrivacyMode: false });
    expect(getOfflinePrivacyMode()).toBe(false);
    await waitFor(() => expect(politeRegion()).toHaveTextContent(`${RT.enabled} ${RT.offlineTurnedOff}`));
    // Configured now: the form is gone, the card is locked and focus is on "Change settings".
    expect(document.getElementById(REMOTE_HOSTNAME_ID)).toBeNull();
    expect(document.getElementById(REMOTE_PASSWORD_ID)).toBeNull();
    await waitFor(() => expect(changeButton()).toHaveFocus());
    expect(within(card()).getByText(RT.ownerNote)).toBeInTheDocument();
    const status = within(card()).getByRole('heading', { name: RT.statusTitle }).closest('section') as HTMLElement;
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(within(status).getByText(RT.busy)).toBeInTheDocument();
    const items = within(status).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent(RT.stepName('duckdns'));
    expect(items[0]).toHaveTextContent(RT.stateLabel('running'));
    // No address until HTTPS listens.
    expect(within(card()).getByText(RT.noUrl)).toBeInTheDocument();
    expect(getRemoteStatus()?.enabled).toBe(true);
  });

  it('shows a wrong password at the password field and keeps everything else', async () => {
    vi.mocked(api.server.remote.put).mockRejectedValue(
      new ApiClientError(400, { code: 'WRONG_PASSWORD', field: 'password', message: 'הסיסמה שגויה.' }),
    );
    const { user } = renderCard({ offlinePrivacyMode: false });
    await waitFor(() => expect(remoteSwitch()).toBeInTheDocument());
    await user.type(field(RT.token), TOKEN);
    await user.click(remoteSwitch());
    await user.type(passwordField(), 'wrong');
    await user.click(saveButton());
    await waitFor(() => expect(passwordField()).toHaveAttribute('aria-invalid', 'true'));
    expect(passwordField()).toHaveAccessibleDescription(`${RT.passwordHint} ${RT.wrongPassword}`);
    expect(passwordField()).toHaveFocus();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(RT.wrongPassword));
    expect(field(RT.token)).toHaveValue(TOKEN);
    expect(remoteSwitch()).toBeChecked();
  });

  it('puts offline privacy mode back when turning on fails', async () => {
    vi.mocked(api.server.remote.put).mockRejectedValue(new Error('refused'));
    const { user } = renderCard({ offlinePrivacyMode: true });
    await waitFor(() => expect(remoteSwitch()).toBeInTheDocument());
    await user.type(field(RT.token), TOKEN);
    await user.click(remoteSwitch());
    await user.type(passwordField(), PASSWORD);
    await user.click(saveButton());
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent('refused'));
    expect(updateSpy.mock.calls).toEqual([[{ offlinePrivacyMode: false }], [{ offlinePrivacyMode: true }]]);
    expect(getOfflinePrivacyMode()).toBe(true);
    expect(within(card()).getByText('refused').closest('.alert--error')).not.toBeNull();
    expect(within(card()).queryByRole('alert')).not.toBeInTheDocument();
    // Still the setup form, with the choice kept.
    expect(remoteSwitch()).toBeChecked();
  });

  it('saves the details without turning remote access on, normalising the name', async () => {
    const { user } = renderCard();
    await waitFor(() => expect(remoteSwitch()).toBeInTheDocument());
    await user.clear(field(RT.hostname));
    await user.type(field(RT.hostname), 'https://My-Diary.duckdns.org/');
    await user.clear(field(RT.publicPort));
    await user.type(field(RT.publicPort), '8443');
    await user.click(upnpBox());
    await user.type(passwordField(), PASSWORD);
    await user.click(saveButton());
    await waitFor(() =>
      expect(api.server.remote.put).toHaveBeenCalledWith({ hostname: 'my-diary.duckdns.org', publicPort: 8443, upnp: false, enabled: false, password: PASSWORD }),
    );
    await waitFor(() => expect(politeRegion()).toHaveTextContent(RT.saved));
    expect(field(RT.hostname)).toHaveValue('my-diary.duckdns.org');
    expect(remoteSwitch()).not.toBeChecked();
    expect(passwordField()).toHaveValue('');
    expect(within(card()).getByText(RT.ownerNote)).toBeInTheDocument();
  });

  it('rejects a name outside duckdns.org and an invalid port', async () => {
    const { user } = renderCard();
    await waitFor(() => expect(remoteSwitch()).toBeInTheDocument());
    await user.clear(field(RT.hostname));
    await user.type(field(RT.hostname), 'example.com');
    await user.clear(field(RT.publicPort));
    await user.type(passwordField(), PASSWORD);
    await user.click(saveButton());
    expect(field(RT.hostname)).toHaveAttribute('aria-invalid', 'true');
    expect(field(RT.hostname)).toHaveFocus();
    expect(within(card()).getByText(RT.hostnameInvalid)).toBeInTheDocument();
    expect(within(card()).getByText(RT.portInvalid)).toBeInTheDocument();
    await waitFor(() => expect(assertiveRegion()).toHaveTextContent(T.fixErrors(2)));
    expect(api.server.remote.put).not.toHaveBeenCalled();
  });

  it('says a token is saved and keeps it when the field stays empty', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(remoteStatusFixture({ hostname: HOST, tokenSet: true, hasOwner: true }));
    const { user } = renderCard({ offlinePrivacyMode: false });
    await waitFor(() => expect(field(RT.token)).toHaveAccessibleDescription(RT.tokenSaved));
    expect(within(card()).getByText(RT.ownerNote)).toBeInTheDocument();
    await user.click(remoteSwitch());
    await user.type(passwordField(), PASSWORD);
    await user.click(saveButton());
    await waitFor(() =>
      expect(api.server.remote.put).toHaveBeenCalledWith({ hostname: HOST, publicPort: 443, upnp: true, enabled: true, password: PASSWORD }),
    );
  });
});

describe('RemoteAccessSection: locked once configured', () => {
  it('shows the summary, test, renewal, the address - and "Change settings" instead of editable fields', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(enabledStatus());
    renderCard({ offlinePrivacyMode: false });
    const current = (await screen.findByRole('heading', { name: RT.currentTitle })).closest('section') as HTMLElement;
    expect(within(card()).getByText(RT.ownerNote)).toBeInTheDocument();
    // Nothing editable.
    for (const id of [REMOTE_HOSTNAME_ID, REMOTE_ACCESS_CHECKBOX_ID, REMOTE_PASSWORD_ID]) expect(document.getElementById(id)).toBeNull();
    expect(within(card()).queryByRole('button', { name: T.save })).not.toBeInTheDocument();
    expect(within(card()).queryByRole('checkbox')).not.toBeInTheDocument();
    // The summary.
    for (const text of [RT.summaryState, RT.summaryOn, RT.hostname, HOST, RT.token, RT.summaryTokenSaved, RT.publicPort, '443', RT.summaryUpnp, RT.summaryUpnpAuto]) {
      expect(current).toHaveTextContent(text);
    }
    expect(within(current).getByText(RT.lockedHint)).toBeInTheDocument();
    expect(within(current).getByRole('button', { name: RT.test })).toBeInTheDocument();
    expect(within(current).getByRole('button', { name: RT.change })).toBeInTheDocument();
    // Status, certificate and renewal; the address with copy and QR.
    const status = within(card()).getByRole('heading', { name: RT.statusTitle }).closest('section') as HTMLElement;
    expect(within(status).getAllByRole('listitem')).toHaveLength(4);
    expect(within(status).getByText(new RegExp(RT.certificateValid('.*', 83, "Let's Encrypt R11").replace(/[()]/g, '.')))).toBeInTheDocument();
    expect(within(status).getByRole('button', { name: RT.renew })).toBeInTheDocument();
    const address = within(card()).getByRole('heading', { name: RT.urlTitle }).closest('section') as HTMLElement;
    expect(within(address).getByRole('button', { name: ST.copyName(URL) })).toBeInTheDocument();
    expect(within(address).getByRole('img', { name: RT.qrLabel(URL) })).toBeInTheDocument();
  });

  it('while off, the locked summary says so and shows the certificate (no test / renew)', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(enabledStatus({ enabled: false, urls: [], tlsPort: null }));
    renderCard({ offlinePrivacyMode: false });
    const current = (await screen.findByRole('heading', { name: RT.currentTitle })).closest('section') as HTMLElement;
    expect(current).toHaveTextContent(RT.summaryOff);
    expect(current).toHaveTextContent(new RegExp(RT.certificateValid('.*', 83, "Let's Encrypt R11").replace(/[()]/g, '.')));
    expect(within(card()).queryByRole('button', { name: RT.test })).not.toBeInTheDocument();
    expect(within(card()).queryByRole('button', { name: RT.renew })).not.toBeInTheDocument();
    expect(within(card()).queryByRole('heading', { name: RT.urlTitle })).not.toBeInTheDocument();
    expect(changeButton()).toBeInTheDocument();
  });

  it('"Change settings" asks for the password in a dialog and only then reveals the form; Save sends it and locks again', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(enabledStatus());
    const { user } = renderCard({ offlinePrivacyMode: false });
    await user.click(await screen.findByRole('button', { name: RT.change }));
    const dialog = await screen.findByRole('dialog', { name: RT.unlockTitle });
    expect(dialog).toHaveTextContent(RT.unlockMessage);
    const pw = within(dialog).getByLabelText(new RegExp(`^${T.password}`)) as HTMLInputElement;
    expect(pw.type).toBe('password');
    await waitFor(() => expect(pw).toHaveFocus());
    const confirm = within(dialog).getByRole('button', { name: T.confirm });

    // Empty: asked again, nothing checked.
    await user.click(confirm);
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(RT.passwordMissing));
    expect(verifyPassword).not.toHaveBeenCalled();
    // Wrong: the form stays closed.
    await user.type(pw, 'wrong');
    await user.click(confirm);
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(RT.wrongPassword));
    expect(pw).toHaveAttribute('aria-invalid', 'true');
    expect(verifyPassword).toHaveBeenLastCalledWith('wrong');
    expect(document.getElementById(REMOTE_HOSTNAME_ID)).toBeNull();
    // Right (Enter works): the form opens with the saved values, the first field focused.
    await user.clear(pw);
    await user.type(pw, `${PASSWORD}{Enter}`);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(verifyPassword).toHaveBeenLastCalledWith(PASSWORD);
    await waitFor(() => expect(field(RT.hostname)).toHaveFocus());
    await waitFor(() => expect(politeRegion()).toHaveTextContent(RT.unlocked));
    expect(field(RT.hostname)).toHaveValue(HOST);
    expect(field(RT.publicPort)).toHaveValue(443);
    expect(upnpBox()).toBeChecked();
    expect(remoteSwitch()).toBeChecked();
    expect(field(RT.token)).toHaveAccessibleDescription(RT.tokenSaved);
    expect(document.getElementById(REMOTE_PASSWORD_ID)).toBeNull();
    expect(within(card()).queryByRole('button', { name: RT.change })).not.toBeInTheDocument();
    expect(within(card()).getByRole('button', { name: T.cancel })).toBeInTheDocument();
    expect(api.server.remote.put).not.toHaveBeenCalled();

    await user.clear(field(RT.publicPort));
    await user.type(field(RT.publicPort), '8443');
    await user.click(saveButton());
    await waitFor(() =>
      expect(api.server.remote.put).toHaveBeenCalledWith({ hostname: HOST, publicPort: 8443, upnp: true, enabled: true, password: PASSWORD }),
    );
    await waitFor(() => expect(politeRegion()).toHaveTextContent(RT.savedLocked));
    expect(document.getElementById(REMOTE_HOSTNAME_ID)).toBeNull();
    await waitFor(() => expect(changeButton()).toHaveFocus());

    // Locked again: the next change asks for the password again.
    await user.click(changeButton());
    expect(await screen.findByRole('dialog', { name: RT.unlockTitle })).toBeInTheDocument();
  });

  it('Cancel in the dialog or in the form changes nothing and keeps the card locked', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(enabledStatus());
    const { user } = renderCard({ offlinePrivacyMode: false });
    await user.click(await screen.findByRole('button', { name: RT.change }));
    let dialog = await screen.findByRole('dialog', { name: RT.unlockTitle });
    await user.click(within(dialog).getByRole('button', { name: T.cancel }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.getElementById(REMOTE_HOSTNAME_ID)).toBeNull();
    expect(verifyPassword).not.toHaveBeenCalled();

    await user.click(changeButton());
    dialog = await screen.findByRole('dialog', { name: RT.unlockTitle });
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), `${PASSWORD}{Enter}`);
    await waitFor(() => expect(field(RT.hostname)).toHaveFocus());
    await user.clear(field(RT.hostname));
    await user.type(field(RT.hostname), 'somewhere-else');
    await user.click(within(card()).getByRole('button', { name: T.cancel }));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(RT.editCancelled));
    expect(document.getElementById(REMOTE_HOSTNAME_ID)).toBeNull();
    await waitFor(() => expect(changeButton()).toHaveFocus());
    expect(api.server.remote.put).not.toHaveBeenCalled();
    // Reopening starts from the saved values, not from the discarded edit.
    await user.click(changeButton());
    dialog = await screen.findByRole('dialog', { name: RT.unlockTitle });
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), `${PASSWORD}{Enter}`);
    await waitFor(() => expect(field(RT.hostname)).toHaveValue(HOST));
  });

  it('locking the app (Ctrl+L) while the form is open locks the card again and forgets the password', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(enabledStatus());
    function AppLock({ children }: { children: ReactNode }) {
      const [locked, setLocked] = useState(false);
      const value = { locked, restoredLocked: false, lock: () => setLocked(true), unlock: () => setLocked(false) };
      return (
        <LockContext.Provider value={value}>
          <button type="button" onClick={() => setLocked((v) => !v)}>
            toggle app lock
          </button>
          {children}
        </LockContext.Provider>
      );
    }
    const { user } = renderWithProviders(
      <StatefulSettings initial={{ offlinePrivacyMode: false }}>
        <AppLock>
          <RemoteAccessSection />
        </AppLock>
      </StatefulSettings>,
      { auth: 'authenticated', authOverrides: { verifyPassword } },
    );
    await user.click(await screen.findByRole('button', { name: RT.change }));
    const dialog = await screen.findByRole('dialog', { name: RT.unlockTitle });
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), `${PASSWORD}{Enter}`);
    await waitFor(() => expect(field(RT.hostname)).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'toggle app lock' }));
    await waitFor(() => expect(document.getElementById(REMOTE_HOSTNAME_ID)).toBeNull());
    await user.click(screen.getByRole('button', { name: 'toggle app lock' }));
    // Unlocked app, locked card: the next change needs the password again; nothing was saved.
    expect(document.getElementById(REMOTE_HOSTNAME_ID)).toBeNull();
    expect(within(card()).queryByRole('button', { name: T.save })).not.toBeInTheDocument();
    await user.click(changeButton());
    expect(await screen.findByRole('dialog', { name: RT.unlockTitle })).toBeInTheDocument();
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(api.server.remote.put).not.toHaveBeenCalled();
  });

  it('asks for the password again (keeping the edits) when the server refuses it on Save', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(enabledStatus());
    vi.mocked(api.server.remote.put).mockRejectedValueOnce(
      new ApiClientError(400, { code: 'WRONG_PASSWORD', field: 'password', message: 'הסיסמה שגויה.' }),
    );
    const { user } = renderCard({ offlinePrivacyMode: false });
    await user.click(await screen.findByRole('button', { name: RT.change }));
    let dialog = await screen.findByRole('dialog', { name: RT.unlockTitle });
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), `${PASSWORD}{Enter}`);
    await waitFor(() => expect(field(RT.hostname)).toHaveFocus());
    await user.clear(field(RT.publicPort));
    await user.type(field(RT.publicPort), '8443');
    await user.click(saveButton());

    dialog = await screen.findByRole('dialog', { name: RT.unlockTitle });
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(RT.wrongPassword));
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), `${NEW_PASSWORD}{Enter}`);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(field(RT.publicPort)).toHaveValue(8443);
    await user.click(saveButton());
    await waitFor(() =>
      expect(api.server.remote.put).toHaveBeenLastCalledWith({ hostname: HOST, publicPort: 8443, upnp: true, enabled: true, password: NEW_PASSWORD }),
    );
    await waitFor(() => expect(politeRegion()).toHaveTextContent(RT.savedLocked));
  });

  it('polls while busy and announces the address when the setup finishes', async () => {
    vi.mocked(api.server.remote.get)
      .mockResolvedValueOnce(enabledStatus({ busy: true, urls: [], certificate: null }))
      .mockResolvedValue(enabledStatus());
    renderCard({ offlinePrivacyMode: false });
    await screen.findByText(RT.busy);
    await waitFor(() => expect(politeRegion()).toHaveTextContent(RT.ready(URL)), { timeout: REMOTE_POLL_BUSY_MS + 3000 });
    expect(api.server.remote.get).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(RT.busy)).not.toBeInTheDocument();
  }, 15000);

  it('shows the steps with icons and words, the certificate, the address with a copy button and its QR code', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(
      enabledStatus({
        steps: [
          { id: 'duckdns', state: 'ok', messageKey: 'settings.remote.ready', params: { url: '1.2.3.4' }, at: '2026-09-28T09:00:00.000Z' },
          { id: 'certificate', state: 'ok', messageKey: '', params: {}, at: null },
          { id: 'listener', state: 'ok', messageKey: '', params: {}, at: null },
          { id: 'upnp', state: 'error', messageKey: 'server.remote.unknownKeyInThisBuild', params: {}, at: null },
        ],
        lastError: { messageKey: 'settings.remote.tokenInvalid', params: {} },
      }),
    );
    renderCard({ offlinePrivacyMode: false });
    const status = (await screen.findByRole('heading', { name: RT.statusTitle })).closest('section') as HTMLElement;
    const items = within(status).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent(`${RT.stepName('duckdns')}${RT.stateLabel('ok')}${RT.ready('1.2.3.4')}`);
    expect(items[0].querySelector('.remote-status__icon')).toHaveTextContent('✓');
    expect(items[0].querySelector('.remote-status__icon')).toHaveAttribute('aria-hidden', 'true');
    expect(items[0]).toHaveTextContent(RT.stepAt('').trim());
    // Unknown message key: the state in words stands alone.
    expect(items[3]).toHaveTextContent(`${RT.stepName('upnp')}${RT.stateLabel('error')}`);
    expect(items[3]).not.toHaveTextContent('server.remote');
    expect(items[3].querySelector('.remote-status__icon')).toHaveTextContent('✗');
    expect(within(status).getByText(RT.lastError(RT.tokenInvalid))).toBeInTheDocument();
    expect(within(status).getByText('203.0.113.7')).toBeInTheDocument();
    expect(within(status).getByText(new RegExp(RT.certificateValid('.*', 83, "Let's Encrypt R11").replace(/[()]/g, '.')))).toBeInTheDocument();

    const address = within(card()).getByRole('heading', { name: RT.urlTitle }).closest('section') as HTMLElement;
    expect(within(address).getByText(URL)).toBeInTheDocument();
    expect(within(address).getByRole('button', { name: ST.copyName(URL) })).toBeInTheDocument();
    const qr = within(address).getByRole('img', { name: RT.qrLabel(URL) });
    expect(qr.querySelector('path')).toHaveAttribute('d', qrSvgPath(encodeQr(URL)));
    const view = encodeQr(URL).size + 8;
    expect(qr).toHaveAttribute('viewBox', `0 0 ${view} ${view}`);

    const how = within(card()).getByRole('heading', { name: RT.instructionsTitle }).closest('section') as HTMLElement;
    expect(within(how).getAllByRole('listitem')[4]).toHaveTextContent(RT.instructions(443, 443, '192.168.1.20')[4]);
  });

  it('runs the connection test (no password, nothing saved) and lists the checks', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(enabledStatus());
    vi.mocked(api.server.remote.test).mockResolvedValue({
      checks: [
        { id: 'duckdns', state: 'ok', messageKey: '', params: {} },
        { id: 'upnp', state: 'warning', messageKey: '', params: {} },
        { id: 'dns', state: 'ok', messageKey: '', params: {} },
        { id: 'https', state: 'skipped', messageKey: '', params: {} },
      ],
      publicIp: '203.0.113.7',
      at: '2026-09-28T12:00:00.000Z',
    });
    const { user } = renderCard({ offlinePrivacyMode: false });
    await user.click(await screen.findByRole('button', { name: RT.test }));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(RT.testDone(2, 3)));
    expect(api.server.remote.test).toHaveBeenCalledWith();
    expect(api.server.remote.put).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
    const results = within(card()).getByRole('heading', { name: RT.testTitle }).closest('section') as HTMLElement;
    const items = within(results).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[1]).toHaveTextContent(`${RT.checkName('upnp')}${RT.stateLabel('warning')}`);
    expect(items[1].querySelector('.remote-status__icon')).toHaveTextContent('⚠');
  });

  it('renews the certificate without a password, and turns remote access off through "Change settings"', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(enabledStatus());
    vi.mocked(api.server.remote.put).mockResolvedValue(enabledStatus({ enabled: false, urls: [], tlsPort: null }));
    const { user } = renderCard({ offlinePrivacyMode: false });
    await user.click(await screen.findByRole('button', { name: RT.renew }));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(RT.renewStarted));
    expect(api.server.remote.renew).toHaveBeenCalledTimes(1);
    expect(verifyPassword).not.toHaveBeenCalled();

    await user.click(changeButton());
    const dialog = await screen.findByRole('dialog', { name: RT.unlockTitle });
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), `${PASSWORD}{Enter}`);
    await waitFor(() => expect(remoteSwitch()).toBeChecked());
    await user.click(remoteSwitch());
    await user.click(saveButton());
    await waitFor(() =>
      expect(api.server.remote.put).toHaveBeenCalledWith({ hostname: HOST, publicPort: 443, upnp: true, enabled: false, password: PASSWORD }),
    );
    await waitFor(() => expect(politeRegion()).toHaveTextContent(RT.disabled));
    const current = within(card()).getByRole('heading', { name: RT.currentTitle }).closest('section') as HTMLElement;
    expect(current).toHaveTextContent(RT.summaryOff);
    expect(within(card()).queryByRole('heading', { name: RT.urlTitle })).not.toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

describe('Privacy card + remote access', () => {
  const offlineBox = () => screen.getByRole('checkbox', { name: new RegExp(`^${ST.offlineLabel}`) });

  it('asks (with the account password) before turning offline privacy mode on while remote access is on, then turns remote access off', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(enabledStatus());
    const { user } = renderCard({ offlinePrivacyMode: false }, true);
    await screen.findByRole('button', { name: RT.change });
    expect(offlineBox()).not.toBeChecked();

    // Cancel: nothing changes.
    await user.click(offlineBox());
    let dialog = await screen.findByRole('dialog', { name: RT.offlineConflictTitle });
    expect(dialog).toHaveTextContent(RT.offlineConflictMessage);
    expect(dialog).toHaveTextContent(RT.offlineConflictPassword);
    await user.click(within(dialog).getByRole('button', { name: T.cancel }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(offlineBox()).not.toBeChecked();
    expect(api.server.remote.put).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();

    // Confirm without the password: asked for it.
    await user.click(offlineBox());
    dialog = await screen.findByRole('dialog', { name: RT.offlineConflictTitle });
    await user.click(within(dialog).getByRole('button', { name: RT.offlineConflictConfirm }));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(RT.passwordMissing));
    expect(api.server.remote.put).not.toHaveBeenCalled();

    // With the password: remote access off, then offline mode on.
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), PASSWORD);
    await user.click(within(dialog).getByRole('button', { name: RT.offlineConflictConfirm }));
    await waitFor(() => expect(api.server.remote.put).toHaveBeenCalledWith({ enabled: false, password: PASSWORD }));
    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith({ offlinePrivacyMode: true }));
    await waitFor(() => expect(politeRegion()).toHaveTextContent(`${ST.offlineOn} ${RT.disabledByOffline}`));
    expect(offlineBox()).toBeChecked();
    expect(getRemoteStatus()?.enabled).toBe(false);
    expect(getOfflinePrivacyMode()).toBe(true);
  });

  it('keeps offline privacy mode off and says so when the password is wrong or remote access cannot be turned off', async () => {
    vi.mocked(api.server.remote.get).mockResolvedValue(enabledStatus());
    vi.mocked(api.server.remote.put)
      .mockRejectedValueOnce(new ApiClientError(400, { code: 'WRONG_PASSWORD', field: 'password', message: 'x' }))
      .mockRejectedValueOnce(new Error('server busy'));
    const { user } = renderCard({ offlinePrivacyMode: false }, true);
    await screen.findByRole('button', { name: RT.change });
    await user.click(offlineBox());
    const dialog = await screen.findByRole('dialog', { name: RT.offlineConflictTitle });
    await user.type(within(dialog).getByLabelText(new RegExp(`^${T.password}`)), 'wrong');
    await user.click(within(dialog).getByRole('button', { name: RT.offlineConflictConfirm }));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(RT.wrongPassword));
    await user.click(within(dialog).getByRole('button', { name: RT.offlineConflictConfirm }));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('server busy'));
    expect(updateSpy).not.toHaveBeenCalled();
    expect(offlineBox()).not.toBeChecked();
  });

  it('turns offline privacy mode on directly while remote access is off', async () => {
    const { user } = renderCard({ offlinePrivacyMode: false }, true);
    await waitFor(() => expect(remoteSwitch()).not.toBeChecked());
    await user.click(offlineBox());
    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith({ offlinePrivacyMode: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.server.remote.put).not.toHaveBeenCalled();
  });

  it('turns offline privacy mode on directly for an account that does not own remote access', async () => {
    vi.mocked(api.server.remote.get).mockRejectedValue(new ApiClientError(403, { code: 'FORBIDDEN', message: 'x' }));
    const { user } = renderCard({ offlinePrivacyMode: false }, true);
    await waitFor(() => expect(api.server.remote.get).toHaveBeenCalled());
    await user.click(offlineBox());
    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith({ offlinePrivacyMode: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.server.remote.put).not.toHaveBeenCalled();
  });
});
