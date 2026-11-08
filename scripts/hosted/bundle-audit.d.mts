/** Types of scripts/hosted/bundle-audit.mjs for the TypeScript tests that import it. */
export declare const FORBIDDEN_BUNDLE_STRINGS: readonly string[];
export declare function forbiddenStringsIn(text: string): string[];
export declare const ADMIN_TOOL_FILE: string;
export declare const ADMIN_TOOL_HOST: string;
export declare function adminBundleProblems(text: string): string[];
