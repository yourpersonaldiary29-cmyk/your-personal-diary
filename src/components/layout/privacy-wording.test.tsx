/**
 * The privacy line of the Welcome page and the footer with the Your Personal Diary server: the apps and the
 * web UI it serves never claim "encrypted end to end" - the server decrypts the diary while you are signed
 * in (docs/HOSTED-PLAN.md section 6: "do not over-claim"). They say where the diary is and that it is
 * encrypted with the password (the wording of Settings -> Privacy, `settings.hosted.reassurance`). A local
 * server (the developer configuration) keeps its wording.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { LOCALES, t } from '@shared/i18n';
import type { ServerInfo } from '@shared/types';
import { __resetConnectionForTests, setServerInfo } from '@/api';
import { trWith } from '@/i18n/runtime';
import WelcomePage from '@/pages/WelcomePage';
import { renderWithProviders } from '@/test/render';
import { Footer } from './Footer';

const en = trWith('en');

const hostedInfo = {
  version: '0.1.0',
  port: 8080,
  lanEnabled: false,
  lanUrls: [],
  dataDir: '',
  isLocalRequest: false,
  startedAt: '2026-10-23T08:00:00.000Z',
  mode: 'hosted',
  publicUrl: 'https://diary.example',
} as unknown as ServerInfo;

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  __resetConnectionForTests();
});

describe('privacy wording with the Your Personal Diary server', () => {
  it('the Windows app (always the server) says "encrypted with your password" on the Welcome page and in the footer', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    renderWithProviders(
      <>
        <WelcomePage />
        <Footer />
      </>,
      { auth: 'anonymous', locale: 'en' },
    );
    expect(screen.getAllByText(en('shell.privacySentenceServer'))).toHaveLength(2);
    expect(screen.queryByText(/end to end/i)).not.toBeInTheDocument();
  });

  it('the web UI served by the hosted server switches once the server described itself', () => {
    setServerInfo(hostedInfo);
    renderWithProviders(<Footer />, { auth: 'anonymous', locale: 'en' });
    expect(screen.getByText(en('shell.privacySentenceServer'))).toBeInTheDocument();
    expect(screen.queryByText(en('shell.footer.privacy'))).not.toBeInTheDocument();
  });

  it('a local server keeps its wording', () => {
    renderWithProviders(
      <>
        <WelcomePage />
        <Footer />
      </>,
      { auth: 'anonymous', locale: 'en' },
    );
    expect(screen.getByText(en('shell.footer.privacy'), { selector: 'footer p' })).toBeInTheDocument();
    expect(screen.queryByText(en('shell.privacySentenceServer'))).not.toBeInTheDocument();
  });

  it('every language uses the Settings -> Privacy wording of the server, not the "end to end" sentence', () => {
    for (const { code } of LOCALES) {
      const server = t(code, 'shell.privacySentenceServer');
      expect(server, code).toBe(t(code, 'settings.hosted.reassurance'));
      expect(server, code).not.toBe(t(code, 'shell.privacySentence'));
      expect(server, code).not.toBe(t(code, 'shell.footer.privacy'));
    }
    expect(en('shell.privacySentenceServer')).not.toMatch(/end.to.end/i);
  });
});
