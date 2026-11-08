/**
 * The two third-party builds the shims wrap. They live in server/node_modules (sql.js and pdfkit
 * are dependencies of server/ - one copy, one version, so the phone writes the same SQLite images
 * and PDFs as the desktop); mobile/core/alias-plugin.ts resolves these specifiers to the files.
 */

/** server/node_modules/sql.js/dist/sql-wasm-browser.js (the build without any Node code). */
declare module 'mobile-vendor:sql.js' {
  interface SqlJsBrowserConfig {
    wasmBinary?: ArrayBuffer | Uint8Array;
    locateFile?: (file: string) => string;
  }
  const initSqlJs: (config?: SqlJsBrowserConfig) => Promise<unknown>;
  export default initSqlJs;
}

/** server/node_modules/pdfkit/js/pdfkit.standalone.js (pdfkit with fontkit, zlib and streams bundled in). */
declare module 'mobile-vendor:pdfkit' {
  /** What the wrapper touches; the rest of the pdfkit API is used by server/src/export/pdf.ts through @types/pdfkit. */
  class StandalonePDFDocument {
    constructor(options?: Record<string, unknown>);
    _registeredFonts: Record<string, { src: unknown; family?: string | null } | undefined>;
    font(src: unknown, family?: unknown, size?: unknown): this;
    registerFont(name: string, src?: unknown, family?: string): this;
  }
  export default StandalonePDFDocument;
}
