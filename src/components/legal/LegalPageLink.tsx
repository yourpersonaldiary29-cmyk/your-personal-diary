/**
 * The links to the legal pages of the diary server (docs/play-tasks/PLAY-LEGAL.md item 4, docs/apple-tasks/TERMS.md):
 * the privacy policy, the Terms of Use, the account-deletion page and the support page - one page each for the
 * Android app, the Windows and Mac apps and the website, served by the fixed diary server at <server>/<page>/
 * (English, the default) and <server>/<page>/<locale>/ (scripts/legal/build-pages.mjs). A link opens the page in
 * the current UI language, and outside the app:
 *  - web UI: a new browser tab (`target="_blank"`, same server);
 *  - Android app: the WebView hands a link to another origin to the system browser (Capacitor's
 *    `Bridge.launchIntent` -> ACTION_VIEW), so the anchor's own default action is all it takes;
 *  - Windows and Mac apps: the webview swallows `target="_blank"` and a plain navigation would replace the app, so
 *    the click is taken over and the address goes to the shell command `open_external_url`
 *    (src-tauri/src/opener.rs), which hands it to the system - the default browser opens it. Should that fail
 *    (an older shell without the command or without the page in its list, no browser set up), the address is
 *    shown as text to open by hand.
 * Only the legal pages of the fixed diary server are ever opened (the one origin the network audit allows); the
 * shell checks the address again with the same rule (`LEGAL_PAGE_PREFIXES`) and refuses anything else.
 */
import { useState, type MouseEvent, type ReactNode } from 'react';
import type { Locale } from '@shared/i18n';
import { DEFAULT_SERVER_URL } from '@/config/server-default';
import { getCurrentLocale, tr } from '@/i18n/runtime';
import { isTauri } from '@/utils/platform';

/** The legal pages of the diary server (the folders scripts/legal/build-pages.mjs writes). */
export type LegalPage = 'privacy' | 'terms' | 'delete-account' | 'support';

/** The address of a legal page of the diary server in `locale`: English at /<page>/, the others at /<page>/<locale>/. */
export function legalPageUrl(page: LegalPage, locale: Locale = getCurrentLocale()): string {
  return `${DEFAULT_SERVER_URL}/${page}/${locale === 'en' ? '' : `${locale}/`}`;
}

/** True only for an https address of the fixed diary server without credentials - nothing else is ever opened. */
export function isDiaryServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === DEFAULT_SERVER_URL && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/** The legal pages the Windows / Mac shell opens (`LEGAL_PAGE_PREFIXES` in src-tauri/src/opener.rs - keep them equal). */
export const LEGAL_PAGE_PATHS = ['/privacy/', '/delete-account/', '/terms/', '/support/'] as const;

/**
 * True only for a legal page of the diary server as `legalPageUrl` writes it: the server's https address, one of
 * the LEGAL_PAGE_PATHS, no query or fragment, already in canonical form (nothing the URL parser would rewrite,
 * such as a dot segment). The shell checks again with its own rule, which also refuses escapes and anything
 * after the page but locale folders.
 */
export function isLegalPageUrl(url: string): boolean {
  if (!isDiaryServerUrl(url)) return false;
  const parsed = new URL(url);
  return parsed.href === url && !parsed.search && !parsed.hash && LEGAL_PAGE_PATHS.some((path) => parsed.pathname.startsWith(path));
}

/**
 * Windows / Mac app: asks the shell to open `url` in the system browser. Resolves false when the address is not
 * a legal page of the diary server or the shell cannot open it (an older shell without the command, no browser
 * found), so the caller can show the address.
 */
export async function openInSystemBrowser(url: string): Promise<boolean> {
  if (!isLegalPageUrl(url) || !isTauri()) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_external_url', { url });
    return true;
  } catch {
    return false;
  }
}

/** The test id of a page's link and of its address line (the privacy ids are the ones the tests always used). */
export function legalTestId(page: LegalPage, part: 'link' | 'address'): string {
  const base = page === 'privacy' ? 'privacy-policy' : page;
  return `${base}-${part}`;
}

export interface LegalPageLinkProps {
  /** Which page the link opens. */
  page: LegalPage;
  /** The visible link text (each screen words it to fit its sentence). */
  children: ReactNode;
  className?: string;
  /**
   * Windows / Mac app: called when the shell could not open the page, so the caller shows the address itself
   * (`LegalPageAddress`) where it fits - e.g. under a checkbox rather than inside its <label>, where it would
   * become part of the box's name. Without it the address is shown right after the link.
   */
  onOpenFailed?: () => void;
}

export function LegalPageLink({ page, children, className, onOpenFailed }: LegalPageLinkProps) {
  const url = legalPageUrl(page);
  const [showAddress, setShowAddress] = useState(false);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // The web UI and the Android app open the link themselves; only the Windows and Mac apps need the shell.
    if (!isTauri()) return;
    event.preventDefault();
    void openInSystemBrowser(url).then((opened) => {
      if (opened) return;
      if (onOpenFailed) onOpenFailed();
      else setShowAddress(true);
    });
  };

  return (
    <>
      <a href={url} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick} data-testid={legalTestId(page, 'link')}>
        {children}
      </a>
      {showAddress && (
        <span className="text-muted text-small" role="status" data-testid={legalTestId(page, 'address')}>
          {' '}
          {tr('shell.legal.openInBrowser', { url })}
        </span>
      )}
    </>
  );
}

/** "Open this address in your web browser: <the page>" - for a caller that handles `onOpenFailed`. */
export function LegalPageAddress({ page, className }: { page: LegalPage; className?: string }) {
  return (
    <p className={['text-muted text-small', className].filter(Boolean).join(' ')} role="status" data-testid={legalTestId(page, 'address')}>
      {tr('shell.legal.openInBrowser', { url: legalPageUrl(page) })}
    </p>
  );
}
