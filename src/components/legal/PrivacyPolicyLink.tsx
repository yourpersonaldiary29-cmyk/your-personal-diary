/**
 * The link to the privacy policy (docs/play-tasks/PLAY-LEGAL.md item 4): one page for the Android app, the
 * Windows app and the website, served by the fixed diary server at <server>/privacy/ (English, the default)
 * and <server>/privacy/<locale>/ (scripts/legal/build-pages.mjs); the delete-account page sits next to it at
 * <server>/delete-account/. The link opens the page in the current UI language, and outside the app:
 *  - web UI: a new browser tab (`target="_blank"`, same server);
 *  - Android app: the WebView hands a link to another origin to the system browser (Capacitor's
 *    `Bridge.launchIntent` -> ACTION_VIEW), so the anchor's own default action is all it takes;
 *  - Windows app: WebView2 swallows `target="_blank"` and a plain navigation would replace the app, so the
 *    click is taken over and the address goes to the shell command `open_external_url`
 *    (src-tauri/src/opener.rs), which hands it to the Windows shell - the default browser opens it. Should
 *    that fail (an older shell without the command, no browser set up), the address is shown as text to
 *    open by hand.
 * Only the legal pages of the fixed diary server are ever opened (the one origin the network audit allows);
 * the shell checks the address again with the same rule and refuses anything else.
 *
 * The registration form carries the link inside its privacy checkbox (RegisterPrivacyConsent, below):
 * "I have read the Privacy policy and agree to it" - without the tick no account is created.
 */
import { useState, type MouseEvent, type ReactNode } from 'react';
import type { Locale } from '@shared/i18n';
import { DEFAULT_SERVER_URL } from '@/config/server-default';
import { getCurrentLocale, tr } from '@/i18n/runtime';
import { isTauri } from '@/utils/platform';

/** The address of a legal page of the diary server in `locale`: English at /<page>/, the others at /<page>/<locale>/. */
export function legalPageUrl(page: 'privacy' | 'delete-account', locale: Locale = getCurrentLocale()): string {
  return `${DEFAULT_SERVER_URL}/${page}/${locale === 'en' ? '' : `${locale}/`}`;
}

/** The privacy policy in the current UI language. */
export function privacyPolicyUrl(locale: Locale = getCurrentLocale()): string {
  return legalPageUrl('privacy', locale);
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

/** The legal pages the Windows shell opens (`LEGAL_PAGE_PREFIXES` in src-tauri/src/opener.rs). */
const LEGAL_PAGE_PATHS = ['/privacy/', '/delete-account/'] as const;

/**
 * True only for a legal page of the diary server as `legalPageUrl` writes it: the server's https address, the
 * path /privacy/... or /delete-account/..., no query or fragment, already in canonical form (nothing the URL
 * parser would rewrite, such as a dot segment). The shell checks again with its own rule, which also refuses
 * escapes and anything after the page but locale folders.
 */
export function isLegalPageUrl(url: string): boolean {
  if (!isDiaryServerUrl(url)) return false;
  const parsed = new URL(url);
  return parsed.href === url && !parsed.search && !parsed.hash && LEGAL_PAGE_PATHS.some((path) => parsed.pathname.startsWith(path));
}

/**
 * Windows app: asks the shell to open `url` in the system browser. Resolves false when the address is not a
 * legal page of the diary server or the shell cannot open it (an older shell without the command, Windows
 * found no browser), so the caller can show the address.
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

export interface PrivacyPolicyLinkProps {
  /** The visible link text (each screen words it to fit its sentence). */
  children: ReactNode;
  className?: string;
  /**
   * Windows app: called when the shell could not open the page, so the caller shows the address itself
   * (`PrivacyPolicyAddress`) where it fits - e.g. under a checkbox rather than inside its <label>, where it
   * would become part of the box's name. Without it the address is shown right after the link.
   */
  onOpenFailed?: () => void;
}

export function PrivacyPolicyLink({ children, className, onOpenFailed }: PrivacyPolicyLinkProps) {
  const url = privacyPolicyUrl();
  const [showAddress, setShowAddress] = useState(false);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // The web UI and the Android app open the link themselves; only the Windows app needs the shell.
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
      <a href={url} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick} data-testid="privacy-policy-link">
        {children}
      </a>
      {showAddress && (
        <span className="text-muted text-small" role="status" data-testid="privacy-policy-address">
          {' '}
          {tr('shell.legal.openInBrowser', { url })}
        </span>
      )}
    </>
  );
}

/** "Open this address in your web browser: <the policy page>" - for a caller that handles `onOpenFailed`. */
export function PrivacyPolicyAddress({ className }: { className?: string }) {
  return (
    <p className={['text-muted text-small', className].filter(Boolean).join(' ')} role="status" data-testid="privacy-policy-address">
      {tr('shell.legal.openInBrowser', { url: privacyPolicyUrl() })}
    </p>
  );
}

/** Stands in for the link inside the translated sentence while it is split around it (never shown). */
const LINK_MARK = '\u0000';

export interface RegisterPrivacyConsentProps {
  /** Id of the checkbox (its error is `<id>-error`). */
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The error under the box (already localised); the box is marked invalid while it is set. */
  error?: string | null;
}

/**
 * The privacy checkbox of the registration form (docs/android-tasks/PRIVACY-CHECKBOX.md), in place of the
 * former line "By creating an account, you agree to our Privacy policy.": a native checkbox whose <label> is
 * "I have read the Privacy policy and agree to it", with the words "Privacy policy" as the link to the policy
 * (PrivacyPolicyLink - outside the app on Windows, Android and the web). Clicking the sentence ticks the box;
 * clicking the link only opens the policy (a link inside a label keeps its own action). The sentence is one
 * catalogue entry with a {policy} placeholder (word order differs between languages) and the link text is its
 * own entry, worded for that sentence (auth.privacyConsentLink - case endings differ).
 *
 * The box is required (aria-required, and the "(required)" marker the other fields show). Its error and the
 * address the Windows shell could not open sit UNDER the box, outside the label, so the box's accessible
 * name stays the sentence alone; the error is tied to the box with aria-describedby.
 */
export function RegisterPrivacyConsent({ id, checked, onChange, error }: RegisterPrivacyConsentProps) {
  const [before, after = ''] = tr('auth.privacyConsent', { policy: LINK_MARK }).split(LINK_MARK);
  const [showAddress, setShowAddress] = useState(false);
  const errorId = `${id}-error`;
  return (
    <div className="consent" data-testid="register-privacy-consent">
      <div className="check">
        <input
          type="checkbox"
          id={id}
          name="privacyAccepted"
          className="check__input"
          checked={checked}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
        <label htmlFor={id} className="check__label">
          {before}
          <PrivacyPolicyLink onOpenFailed={() => setShowAddress(true)}>{tr('auth.privacyConsentLink')}</PrivacyPolicyLink>
          {after}
          <span className="field__required" aria-hidden="true">
            ({tr('shell.required')})
          </span>
        </label>
      </div>
      {error && (
        <p id={errorId} className="field__error consent__below">
          {error}
        </p>
      )}
      {showAddress && <PrivacyPolicyAddress className="consent__below" />}
    </div>
  );
}
