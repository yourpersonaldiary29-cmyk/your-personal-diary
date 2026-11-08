/** Types of scripts/play/check-listing.mjs for the TypeScript tests that import it. */
export declare const ROOT: string;
export declare const DEFAULT_LISTING_DIR: string;
export declare const BRAND: string;
export declare const FILES: readonly string[];
export declare const LIMITS: Record<string, number>;
export declare const PLAY_LOCALES: Record<string, { app: string; name: string; scripts: string[] }>;
export declare function normalise(raw: string): string;
export declare function playLength(raw: string): number;
export declare function textProblems(locale: string, file: string, raw: string, english?: string | null): string[];
export interface ListingRow {
  locale: string;
  file: string;
  length: number | null;
  limit: number;
  problems: string[];
}
export interface ListingResult {
  rows: ListingRow[];
  problems: string[];
  ok: boolean;
}
export declare function checkListing(dir?: string): ListingResult;
export declare function formatReport(result: ListingResult): string;
