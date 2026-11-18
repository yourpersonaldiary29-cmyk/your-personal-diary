/** Types of scripts/site/downloads-shared.mjs (the Downloads list and its markup) for the hosted server and its tests. */

/** The platforms of the Downloads page, in tab order. */
export type DownloadPlatform = 'windows' | 'android' | 'mac';
/** One row of a downloads list: the installer file of one version. */
export interface DownloadRow {
  version: string;
  date: string;
  file: string;
  bytes: number;
  sha256: string;
}
export type Downloads = Record<DownloadPlatform, DownloadRow[]>;
export type DownloadRegion = 'rows' | 'empty' | 'sums';
/** What a row needs of its page: the folder of the page in the site, its direction, the number format of its language. */
export interface DownloadPage {
  dir: string;
  rtl: boolean;
  intl: string;
}

export declare const FILES_DIR: string;
export declare const IMAGE_LIST_FILE: string;
export declare const DOWNLOAD_PLATFORMS: Record<DownloadPlatform, { extension: string }>;
export declare const PLATFORMS: readonly DownloadPlatform[];
export declare const DOWNLOAD_ROW_KEYS: readonly (keyof DownloadRow)[];
export declare const PUBLIC_NAMES: Record<DownloadPlatform, (version: string) => string>;
export declare function isVersion(value: unknown): value is string;
export declare function isIsoDate(value: unknown): value is string;
export declare function isFileName(value: unknown): value is string;
export declare function isSha256(value: unknown): value is string;
export declare function compareVersions(a: string, b: string): number;
export declare function downloadsProblems(raw: unknown, options?: { allowEmpty?: boolean }): string[];
export declare function cleanDownloads(raw: unknown): Downloads;
export declare function formatDownloads(downloads: Downloads): string;
export declare function escapeHtml(s: unknown): string;
export declare function isolateLatin(text: string): string;
export declare function relativeHref(fromDir: string, target: string): string;
export declare function megabytes(bytes: number, intl: string): string;
export declare const DOWNLOAD_REGIONS: readonly DownloadRegion[];
export declare function downloadMarker(platform: DownloadPlatform, region: DownloadRegion, end?: boolean): string;
export declare function downloadRowHtml(row: DownloadRow, page: DownloadPage): string;
export declare function downloadSumHtml(row: DownloadRow): string;
export declare function downloadRegions(platform: DownloadPlatform, rows: readonly DownloadRow[], page: DownloadPage & { emptyHtml: string }): Record<DownloadRegion, string>;
export declare function replaceDownloadRegions(html: string, downloads: Partial<Record<DownloadPlatform, readonly DownloadRow[]>>, page: DownloadPage): string | null;
