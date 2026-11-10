/**
 * The link to the privacy policy (docs/play-tasks/PLAY-LEGAL.md item 4) and the registration consent - thin
 * wrappers around LegalPageLink (./LegalPageLink.tsx), which holds the addresses, the shell rule and how a page is
 * opened outside the app. Kept under this name so the existing imports and tests stay.
 *
 * The registration form carries the links inside its ONE consent checkbox (RegisterPrivacyConsent, below):
 * "I have read the Privacy Policy and the Terms of Use, and I agree to them" - without the tick no account is
 * created (docs/android-tasks/PRIVACY-CHECKBOX.md, docs/apple-tasks/TERMS.md).
 */
import { useState, type ReactNode } from 'react';
import type { Locale } from '@shared/i18n';
import { getCurrentLocale, tr } from '@/i18n/runtime';
import { LegalPageAddress, LegalPageLink, legalPageUrl, type LegalPage } from './LegalPageLink';

export {
  isDiaryServerUrl,
  isLegalPageUrl,
  LEGAL_PAGE_PATHS,
  LegalPageAddress,
  LegalPageLink,
  legalPageUrl,
  openInSystemBrowser,
  type LegalPage,
} from './LegalPageLink';

/** The privacy policy in the current UI language. */
export function privacyPolicyUrl(locale: Locale = getCurrentLocale()): string {
  return legalPageUrl('privacy', locale);
}

/** The Terms of Use in the current UI language. */
export function termsUrl(locale: Locale = getCurrentLocale()): string {
  return legalPageUrl('terms', locale);
}

export interface PrivacyPolicyLinkProps {
  /** The visible link text (each screen words it to fit its sentence). */
  children: ReactNode;
  className?: string;
  /** See LegalPageLink: the caller shows the address itself when the shell could not open the page. */
  onOpenFailed?: () => void;
}

/** The link to the privacy policy (LegalPageLink with page="privacy"). */
export function PrivacyPolicyLink(props: PrivacyPolicyLinkProps) {
  return <LegalPageLink page="privacy" {...props} />;
}

/** "Open this address in your web browser: <the policy page>" - for a caller that handles `onOpenFailed`. */
export function PrivacyPolicyAddress({ className }: { className?: string }) {
  return <LegalPageAddress page="privacy" className={className} />;
}

/** Stand in for the two links inside the translated sentence while it is split around them (never shown). */
const POLICY_MARK = '\u0000';
const TERMS_MARK = '\u0001';

/**
 * The consent sentence cut around its two links, in the order the language puts them: text, link, text, link,
 * text (a language may name the terms first). Exported for tests.
 */
export function consentParts(): Array<string | { page: LegalPage }> {
  const sentence = tr('auth.legalConsent', { policy: POLICY_MARK, terms: TERMS_MARK });
  const parts: Array<string | { page: LegalPage }> = [];
  let text = '';
  for (const ch of sentence) {
    if (ch === POLICY_MARK || ch === TERMS_MARK) {
      parts.push(text);
      parts.push({ page: ch === POLICY_MARK ? 'privacy' : 'terms' });
      text = '';
    } else {
      text += ch;
    }
  }
  parts.push(text);
  return parts;
}

export interface RegisterPrivacyConsentProps {
  /** Id of the checkbox (its error is `<id>-error`). */
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The error under the box (already localised); the box is marked invalid while it is set. */
  error?: string | null;
}

/**
 * The consent checkbox of the registration form (docs/android-tasks/PRIVACY-CHECKBOX.md, docs/apple-tasks/TERMS.md):
 * ONE native checkbox whose <label> is ONE sentence, "I have read the Privacy Policy and the Terms of Use, and I agree
 * to them", with the two document names as the links to their pages (LegalPageLink - outside the app on Windows,
 * Mac, Android and the web). Ticking it confirms both documents: the registration page sends `privacyAccepted` and
 * `termsAccepted` together. Clicking the sentence ticks the box; clicking a link only opens its page (a link inside
 * a label keeps its own action) - both links are real links, reachable with the keyboard and read by screen
 * readers. The sentence is one catalogue entry with the placeholders {policy} and {terms} (word order differs
 * between languages) and each link text is its own entry, worded for that sentence (auth.privacyConsentLink,
 * auth.termsConsentLink - case endings differ).
 *
 * The box is required (aria-required, and the "(required)" marker the other fields show). Its error and any
 * address the shell could not open sit UNDER the box, outside the label, so the box's accessible name stays the
 * sentence alone; the error is tied to the box with aria-describedby.
 */
export function RegisterPrivacyConsent({ id, checked, onChange, error }: RegisterPrivacyConsentProps) {
  const [failed, setFailed] = useState<LegalPage[]>([]);
  const errorId = `${id}-error`;
  const linkText = (page: LegalPage) => (page === 'privacy' ? tr('auth.privacyConsentLink') : tr('auth.termsConsentLink'));
  const onOpenFailed = (page: LegalPage) => setFailed((prev) => (prev.includes(page) ? prev : [...prev, page]));
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
          {consentParts().map((part, i) =>
            typeof part === 'string' ? (
              part
            ) : (
              <LegalPageLink key={i} page={part.page} onOpenFailed={() => onOpenFailed(part.page)}>
                {linkText(part.page)}
              </LegalPageLink>
            ),
          )}
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
      {failed.map((page) => (
        <LegalPageAddress key={page} page={page} className="consent__below" />
      ))}
    </div>
  );
}
