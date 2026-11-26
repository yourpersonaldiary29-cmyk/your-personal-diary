/**
 * The Downloads page of the site as the "Update needed" screen opens it (app version 1.1.0;
 * src/components/legal/LegalPageLink.tsx `downloadsPageUrl` / `isDownloadsPageUrl` / `DOWNLOADS_PAGE_PATHS`) and
 * its mirror in the Windows / Mac shell (src-tauri/src/opener.rs `downloads_page_paths`):
 *  - English (the default language) at <server>/about/downloads/, the 19 other languages at
 *    <server>/about/<code>/downloads/ - the folders scripts/site/build-site.mjs writes;
 *  - exactly those addresses: no query, no fragment, no other host, no other path, nothing near them;
 *  - the shell's list holds the same 20 paths and no store host.
 * The Rust side has its own unit tests (cargo test opener).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { LOCALE_CODES } from '@shared/i18n';
import { DEFAULT_SERVER_URL } from '@/config/server-default';
import { setCurrentLocale } from '@/i18n/runtime';
import { siteDir } from '../../../scripts/site/build-site.mjs';
import libSourceText from '../../../src-tauri/src/lib.rs?raw';
import openerSource from '../../../src-tauri/src/opener.rs?raw';
import { DOWNLOADS_PAGE_PATHS, downloadsPagePath, downloadsPageUrl, isDownloadsPageUrl, isLegalPageUrl, openInSystemBrowser } from './LegalPageLink';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const OTHER = ['evil', 'example'].join('.');

describe('the Downloads page addresses', () => {
  afterEach(() => {
    setCurrentLocale('en');
  });

  it('English without a folder, every other language in its own folder - the folders the site builder writes', () => {
    expect(downloadsPageUrl('en')).toBe(`${DEFAULT_SERVER_URL}/about/downloads/`);
    expect(downloadsPageUrl('he')).toBe(`${DEFAULT_SERVER_URL}/about/he/downloads/`);
    expect(DOWNLOADS_PAGE_PATHS).toHaveLength(20);
    for (const code of LOCALE_CODES) {
      expect(downloadsPagePath(code), code).toBe(`/about/${siteDir('downloads', code)}`);
      expect(isDownloadsPageUrl(downloadsPageUrl(code)), code).toBe(true);
      // Not a legal page: the legal rule stays as it was.
      expect(isLegalPageUrl(downloadsPageUrl(code)), code).toBe(false);
    }
  });

  it('follows the UI language', () => {
    setCurrentLocale('ja');
    expect(downloadsPageUrl()).toBe(`${DEFAULT_SERVER_URL}/about/ja/downloads/`);
  });

  it('only exactly those addresses: nothing before, after or inside them', () => {
    const host = new URL(DEFAULT_SERVER_URL).host;
    for (const url of [
      `${DEFAULT_SERVER_URL}/about/downloads`,
      `${DEFAULT_SERVER_URL}/about/en/downloads/`,
      `${DEFAULT_SERVER_URL}/about/xx/downloads/`,
      `${DEFAULT_SERVER_URL}/about/HE/downloads/`,
      `${DEFAULT_SERVER_URL}/about/downloads/?x=1`,
      `${DEFAULT_SERVER_URL}/about/downloads/#windows`,
      `${DEFAULT_SERVER_URL}/about/downloads/index.html`,
      `${DEFAULT_SERVER_URL}/about/downloads//`,
      `${DEFAULT_SERVER_URL}/about//downloads/`,
      `${DEFAULT_SERVER_URL}/about/he/downloads/../../api/`,
      `${DEFAULT_SERVER_URL}/downloads/`,
      `${DEFAULT_SERVER_URL}/about/`,
      `http://${host}/about/downloads/`,
      `https://${OTHER}/about/downloads/`,
      `https://${host}.${OTHER}/about/downloads/`,
      `https://user@${host}/about/downloads/`,
      ` ${DEFAULT_SERVER_URL}/about/downloads/`,
      '',
    ]) {
      expect(isDownloadsPageUrl(url), url).toBe(false);
    }
  });
});

describe('the Windows / Mac shell opens them', () => {
  afterEach(() => {
    vi.mocked(invoke).mockReset();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('openInSystemBrowser hands a Downloads page to open_external_url; anything near it is refused before the shell', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockResolvedValue(undefined);
    await expect(openInSystemBrowser(downloadsPageUrl('he'))).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith('open_external_url', { url: `${DEFAULT_SERVER_URL}/about/he/downloads/` });
    vi.mocked(invoke).mockClear();
    await expect(openInSystemBrowser(`${downloadsPageUrl('he')}?x=1`)).resolves.toBe(false);
    await expect(openInSystemBrowser(`https://${OTHER}/about/downloads/`)).resolves.toBe(false);
    expect(invoke).not.toHaveBeenCalled();
    // The shell refuses (an older shell without the page in its list): false, so the caller shows the address.
    vi.mocked(invoke).mockRejectedValue('open_external_url opens only ...');
    await expect(openInSystemBrowser(downloadsPageUrl('en'))).resolves.toBe(false);
  });

  it('outside the desktop shell nothing is asked of it', async () => {
    await expect(openInSystemBrowser(downloadsPageUrl('en'))).resolves.toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('the shell\'s list (src-tauri/src/opener.rs) is built from the same rule and holds no store host', () => {
    // English at /about/downloads/, every other UI language at /about/<code>/downloads/ - the same 20 languages.
    expect(openerSource).toContain('"/about/downloads/".to_string()');
    expect(openerSource).toContain('format!("/about/{code}/downloads/")');
    expect(openerSource).toContain('const DEFAULT_LOCALE: &str = "en";');
    const rustLocales = /const UI_LOCALES: \[&str; 20\] = \[([^\]]+)\]/.exec(libSourceText)?.[1].match(/"([a-z]+)"/g)?.map((s) => s.slice(1, -1));
    expect([...(rustLocales ?? [])].sort()).toEqual([...LOCALE_CODES].sort());
    // Outside the tests' own refusals (which name them from parts), the shell names no store.
    const code = openerSource.split('#[cfg(test)]')[0];
    for (const store of ['play.google', 'apps.apple', 'microsoft.com', 'itms', 'market:']) expect(code).not.toContain(store);
  });
});

