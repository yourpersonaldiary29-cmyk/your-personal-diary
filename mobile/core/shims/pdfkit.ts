/**
 * `pdfkit` of the Android core: the package's standalone browser build (pdfkit + fontkit + zlib +
 * streams in one file, no Node built-ins) behind a thin subclass that loads FONT FILES.
 *
 * server/src/export/pdf.ts names fonts by path (`new PDFDocument({ font: file })`,
 * `registerFont(name, file, family)`, `font(file)`), and the Node build of pdfkit reads those files
 * with its own `fs`. The standalone build has only an internal, empty virtual file system, so a
 * path would fail there. The subclass turns every font path into the file's bytes - read through
 * `node:fs`, which the alias plugin maps to the virtual file system of the core - before pdfkit
 * sees it. pdfkit then caches the parsed font under the same name as on the desktop.
 *
 * What the virtual file system must provide (WP-4 / WP-5): the font files as read-only assets at
 * the paths export/fonts.ts resolves - `<assetsDir>/fonts/DejaVuSans.ttf`, `DejaVuSans-Bold.ttf`
 * and the Noto Sans Arabic / Devanagari / Thai pairs - visible to `statSync().isFile()` and
 * `readFileSync()`. A family whose files are absent is skipped exactly as on the desktop.
 */
import fs from 'node:fs';
import StandalonePDFDocument from 'mobile-vendor:pdfkit';

/** The 14 fonts every PDF reader has; pdfkit builds them from metrics it carries itself. */
const STANDARD_FONTS = new Set([
  'Courier',
  'Courier-Bold',
  'Courier-Oblique',
  'Courier-BoldOblique',
  'Helvetica',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'Helvetica-BoldOblique',
  'Times-Roman',
  'Times-Bold',
  'Times-Italic',
  'Times-BoldItalic',
  'Symbol',
  'ZapfDingbats',
]);

function isFontPath(src: unknown): src is string {
  return typeof src === 'string' && !STANDARD_FONTS.has(src);
}

/** The content of a font file as a plain Uint8Array (what the standalone build accepts). */
function readFontFile(file: string): Uint8Array {
  const data: Uint8Array = fs.readFileSync(file);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

class MobilePDFDocument extends StandalonePDFDocument {
  font(src: unknown, family?: unknown, size?: unknown): this {
    if (typeof src === 'string') {
      const registered = this._registeredFonts[src];
      if (registered) {
        // registerFont(name, file): read the file the first time the font is used.
        if (isFontPath(registered.src)) registered.src = readFontFile(registered.src);
      } else if (isFontPath(src)) {
        // font(file): register the bytes under the path, so the parsed font is cached by that name.
        this._registeredFonts[src] = { src: readFontFile(src), family: typeof family === 'string' ? family : undefined };
      }
    }
    return super.font(src, family, size);
  }
}

export default MobilePDFDocument;
