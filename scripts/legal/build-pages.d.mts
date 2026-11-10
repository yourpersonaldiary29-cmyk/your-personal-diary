/** Types of scripts/legal/build-pages.mjs for the TypeScript tests that import it. */
export interface LegalSettings {
  publisherName: string | null;
  contactEmail: string | null;
  effectiveDate: string;
  /** The effective date of the Terms of Use (shared/legal.ts TERMS_VERSION). */
  termsEffectiveDate: string;
  minimumAge: number;
}
export interface LegalLocale {
  code: string;
  name: string;
  dir: 'ltr' | 'rtl';
  intl: string;
}
export type LegalPageId = 'privacy' | 'delete-account' | 'support' | 'terms';
export interface LegalPage {
  id: LegalPageId;
  sourceDir: string;
  prefix: string;
  /** The page the footer link (front matter "otherPage") leads to. */
  footer: LegalPageId;
}
export declare const ROOT: string;
export declare const SETTINGS_FILE: string;
export declare const SERVER_DEFAULT_FILE: string;
export declare const BRAND: string;
export declare const LOCALES: readonly LegalLocale[];
export declare const DEFAULT_LOCALE: string;
export declare const PAGES: readonly LegalPage[];
export declare const SETTING_KEYS: readonly string[];
export declare const SETTING_PLACEHOLDERS: Record<string, keyof LegalSettings>;
export declare const PLACEHOLDERS: readonly string[];
export declare function readSettings(root?: string, file?: string): LegalSettings;
export declare function settingsProblems(raw: unknown): string[];
export declare function unsetSettings(settings: LegalSettings): string[];
export declare function readSiteUrl(root?: string): string;
export declare function escapeHtml(s: string): string;
export declare function parseSource(text: string, name?: string): { meta: Record<string, string>; body: string };
export declare function inline(text: string): string;
export declare function markdownToHtml(md: string): string;
export declare function pagePath(pageId: string, locale: string): string;
export declare function dateInWords(iso: string, intl: string): string;
export declare function fillPlaceholders(html: string, values: Record<string, string | null | undefined>, name?: string): string;
export declare function renderPage(args: { page: LegalPage; locale: string; source: string; settings: LegalSettings; siteUrl: string }): string;
export declare function sourceFile(root: string, page: LegalPage, locale: string): string;
export declare function buildAll(args?: { root?: string; settings?: LegalSettings; siteUrl?: string }): Map<string, string>;
export declare function existingPages(root?: string): string[];
export declare const UNTRANSLATED_MARKER: string;
export declare function untranslatedSources(root?: string): string[];
export declare function diffWithDisk(files: Map<string, string>, root?: string): string[];
export declare function writeAll(files: Map<string, string>, root?: string): void;
