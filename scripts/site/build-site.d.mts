/** Types of scripts/site/build-site.mjs (the public site, version 2) for the TypeScript tests that import it. */
import type { LegalSettings } from '../legal/build-pages.mjs';

export type StoreLinkKey = 'googlePlay' | 'appStoreIphone' | 'appStoreMac' | 'microsoftStore';
/** The platforms of the Downloads page, in tab order. */
export type DownloadPlatform = 'windows' | 'android' | 'mac';
export type SitePageId = 'home' | 'terms' | 'faq' | 'privacy' | 'downloads' | 'sent' | 'error';
/** site/settings.json: siteBaseUrl null = <server>/about/; a link null = the store has not published the app. */
export interface SiteSettings {
  siteBaseUrl: string | null;
  copyrightYear: number;
  links: Record<StoreLinkKey, string | null>;
}
export interface StoreLinkDef {
  hosts: string[];
  platform: DownloadPlatform | 'iphone';
}
export interface SitePage {
  id: SitePageId;
  /** The folder of the page inside the folder of its language ('' = the home page). */
  dir: string;
  /** The page ends with the contact block. */
  contact: boolean;
  /** The document of legal/<kind>/ the page shows. */
  legal?: 'terms' | 'privacy';
  noindex?: boolean;
}
/** One row of site/downloads.json: the installer file of one version. */
export interface DownloadRow {
  version: string;
  date: string;
  file: string;
  bytes: number;
  sha256: string;
}
export type Downloads = Record<DownloadPlatform, DownloadRow[]>;
export interface SiteShot {
  id: string;
  kind: 'phone' | 'desktop';
  file: string;
  width: number;
  height: number;
}
export interface SiteImage extends SiteShot {
  /** Where the image is published, relative to the top of the site (img/<locale>/<id>.png). */
  rel: string;
  /** Where it comes from, relative to the project. */
  source: string;
}
export type ThemeColours = Record<string, string>;
export interface SiteTheme {
  light: ThemeColours;
  dark: ThemeColours;
}
/** A built site in memory. Every path is relative to the top of the site (the folder about/ of a tree). */
export interface BuiltSite {
  /** 'index.html', 'he/terms/index.html', ... -> HTML (140 pages). */
  pages: Map<string, string>;
  /** 'site.css', 'site.js' -> their text. */
  files: Map<string, string>;
  /** 'img/he/phone-home.png', 'files/<installer>', ... -> the file to copy. */
  assets: Map<string, string>;
  downloads: Downloads;
  /** The public address of the top of the site, with its final slash. */
  siteBase: string;
  /** Content files and legal sources that still carry the TODO-TRANSLATE marker. */
  untranslated: string[];
  /** Legal translations whose outline (headings, list items) is not the English one, each with its first gap. */
  behind: string[];
  /** Placeholders of legal/settings.json values that are still null. */
  unset: string[];
}
export declare const ROOT: string;
export declare const UNTRANSLATED_MARKER: string;
export declare const SITE_ID: string;
export declare const SETTINGS_FILE: string;
export declare const CONTENT_DIR: string;
export declare const DOWNLOADS_FILE: string;
export declare const DOWNLOADS_DIR: string;
export declare const SCRIPT_FILE: string;
export declare const DEFAULT_OUT_DIR: string;
export declare const TOKENS_FILE: string;
export declare const ICON_FILE: string;
export declare const MARKER_KEY: string;
export declare const MAX_PAGE_BYTES: number;
export declare const MAX_LEGAL_PAGE_BYTES: number;
export declare const MAX_CSS_BYTES: number;
export declare const MAX_SCRIPT_BYTES: number;
export declare const GENERATOR_TAG: string;
export declare const CONTACT_ACTION: string;
export declare const CSS_NAME: string;
export declare const SCRIPT_NAME: string;
export declare const FILES_DIR: string;
export declare const SCRIPT_FORBIDDEN: ReadonlyArray<readonly [string, RegExp]>;
export declare function scriptProblems(text: string): string[];
export declare const SITE_PAGES: readonly SitePage[];
export declare const MENU: ReadonlyArray<readonly [SitePageId, string]>;
export declare function siteDir(pageId: string, locale: string): string;
export declare function pageFile(pageId: string, locale: string): string;
export declare function relativeHref(fromDir: string, target: string): string;
export declare const STORE_LINKS: Record<StoreLinkKey, StoreLinkDef>;
export declare const SITE_SETTING_KEYS: readonly string[];
export declare function siteSettingsProblems(raw: unknown): string[];
export declare function readSiteSettings(root?: string, file?: string): SiteSettings;
export declare function storeHosts(siteSettings: SiteSettings): string[];
export declare function siteBaseOf(siteSettings: SiteSettings, siteUrl: string): string;
export declare const DOWNLOAD_PLATFORMS: Record<DownloadPlatform, { extension: string }>;
export declare const PLATFORMS: readonly DownloadPlatform[];
export declare const DOWNLOAD_ROW_KEYS: readonly (keyof DownloadRow)[];
export declare function isVersion(value: unknown): boolean;
export declare function isIsoDate(value: unknown): boolean;
export declare function compareVersions(a: string, b: string): number;
export declare function downloadsProblems(raw: unknown, options?: { allowEmpty?: boolean }): string[];
export declare function readDownloads(root?: string, file?: string): Downloads;
export declare function formatDownloads(downloads: Downloads): string;
export declare function fileSha256(file: string): string;
export declare function downloadFileProblem(dir: string, row: DownloadRow, name?: string, list?: string): string | null;
export declare function megabytes(bytes: number, intl: string): string;
export declare const PLACEHOLDERS: readonly string[];
export declare const LINK_TARGETS: readonly string[];
export declare const FAQ_GROUP_SIZES: readonly number[];
export declare const FAQ_COUNT: number;
export declare const CONTENT_SCHEMA: Record<string, unknown>;
export declare function placeholdersOf(text: string): string[];
export declare function linkTargetsOf(text: string): string[];
export declare function flattenContent(content: unknown): Map<string, string>;
export declare function contentStatus(content: unknown): null | 'all' | string[];
export declare function contentProblems(content: unknown, base?: unknown): string[];
export declare function contentFile(root: string, locale: string): string;
export declare function untranslatedContent(root?: string): string[];
export declare const LEGAL_KINDS: readonly ('terms' | 'privacy')[];
export declare function legalSourceFile(root: string, kind: string, locale: string): string;
export declare function legalOutline(source: string): Array<{ level: number; title: string; items: number }>;
export declare function legalOutlineGap(source: string, englishSource: string): string | null;
export declare const PLAY_FOLDER: Record<string, string>;
export declare const STORE_FOLDER: Record<string, string>;
export declare const SHOTS: readonly SiteShot[];
export declare const SHARE_IMAGE: { rel: string; source: string; width: number; height: number };
export declare const ICON_IMAGE: { rel: string; source: string };
export declare function shotsOf(locale: string): SiteImage[];
export declare function pngSize(file: string): { width: number; height: number };
export declare const THEME_TOKENS: Record<string, string | { light: string; dark: string }>;
export declare const COLOR_PAIRS: ReadonlyArray<readonly [string, string]>;
export declare const CONTROL_PAIRS: ReadonlyArray<readonly [string, string]>;
export declare const DECOR_COLORS: readonly string[];
export declare function readThemeTokens(root?: string): SiteTheme;
export declare const FONT_STACK: string;
export declare function siteCss(theme: SiteTheme): string;
export declare function renderLegalDocument(args: {
  kind: string;
  locale: string;
  source: string;
  settings: LegalSettings;
  siteUrl: string;
  links: { privacy: string; terms: string };
  shown: { privacy: string; terms: string };
}): { title: string; description: string; html: string };
export declare function renderSitePage(args: {
  page: SitePageId;
  locale: string;
  content: unknown;
  settings: LegalSettings;
  siteSettings: SiteSettings;
  siteUrl: string;
  downloads?: Downloads;
  source?: string;
}): string;
export declare function buildSite(args?: { root?: string; settings?: LegalSettings; siteSettings?: SiteSettings; siteUrl?: string }): BuiltSite;
export declare function writeSite(site: BuiltSite, webRoot: string): string;
export declare function siteFolderProblems(folder: string): string[];
export declare function siteTreeProblems(webRoot: string): string[];
export declare function main(argv: string[], options?: { root?: string; log?: Pick<Console, 'log' | 'warn' | 'error'> }): number;
