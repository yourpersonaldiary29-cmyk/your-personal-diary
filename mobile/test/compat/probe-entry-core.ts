/**
 * Second entry of the "core import probe" (core-import-probe.test.ts): the two third-party
 * engines of the core - SQLite (sql.js) and the PDF writer (pdfkit) - driven by the unchanged
 * server modules, in a JavaScript context without Node.js, without fetch and without a file
 * system. What a real worker gets from the host arrives here as arguments:
 *
 *   sql-wasm.wasm   -> provideSqlWasm(bytes)                     (mobile/core/shims/sqljs.ts)
 *   the font files  -> vfs.registerAsset('/assets/fonts/..')      (mobile/core/vfs)
 *
 * Binary data crosses the context boundary as base64 text (typed arrays of another context are
 * not `instanceof Uint8Array` here - in the app, worker messages are deserialised in the worker).
 */
import '../../core/shims/globals';
import { Buffer } from '../../core/shims/buffer';
import { MOBILE_ASSETS_DIR } from '../../core/shims/paths';
import { hasSqlWasm, provideSqlWasm } from '../../core/shims/sqljs';
import { Vfs, installVfs } from '../../core/vfs';
import { DiaryDb } from '../../../server/src/db/database';
import { createEntry, listEntriesFull, validateEntryInput } from '../../../server/src/db/entries-repo';
import { collectExportData, renderExport } from '../../../server/src/export/index';
import { resolvePdfFontSet } from '../../../server/src/export/fonts';
import * as container from '../../../server/src/security/container';
import * as kdf from '../../../server/src/security/kdf';
import { exportImage } from '../../../server/src/security/vault';
import type { Locale } from '../../../shared/i18n';
import type { UserProfile } from '../../../shared/types';

export interface CoreProbeInput {
  sqlWasmBase64: string;
  /** File name (as in src-tauri/resources/server/fonts) -> content. */
  fontsBase64: Record<string, string>;
  password: string;
  entries: unknown[];
  user: UserProfile;
  locale: Locale;
}

export interface CoreProbeResult {
  sqlInitBeforeWasm: string;
  pdfBeforeFonts: string;
  entriesJson: string;
  containerBase64: string;
  /** Which families the font lookup found in the virtual file system. */
  fontFamilies: string[];
  pdfBase64: string;
  csvBase64: string;
  txtBase64: string;
  jsonBase64: string;
}

function failure(e: unknown): string {
  const error = e as { code?: unknown; message?: unknown };
  return `${String(error.code ?? '')}: ${String(error.message ?? e)}`;
}

export async function run(input: CoreProbeInput): Promise<CoreProbeResult> {
  const vfs = new Vfs();
  installVfs(vfs);

  // Before the host delivered the WebAssembly binary the database cannot start - and says so.
  let sqlInitBeforeWasm = 'no error';
  if (!hasSqlWasm()) {
    try {
      await DiaryDb.create();
    } catch (e) {
      sqlInitBeforeWasm = failure(e);
    }
  }
  provideSqlWasm(Buffer.from(input.sqlWasmBase64, 'base64'));

  const db = await DiaryDb.create();
  try {
    for (const entry of input.entries) createEntry(db, validateEntryInput(entry));
    const entriesJson = JSON.stringify(listEntriesFull(db, null, null));

    const salt = kdf.newSalt();
    const { key } = kdf.splitSecret(await kdf.deriveSecret(input.password, salt));
    const sealed = container.encryptContainer(exportImage(db), key, salt);

    const data = collectExportData(db, { format: 'pdf', includeHabits: true }, input.user, input.locale, new Date('2026-10-02T09:30:00.000Z'));

    // Without the fonts the PDF export fails with the EXPORT error of the desktop, not a crash.
    let pdfBeforeFonts = 'no error';
    try {
      await renderExport(data, 'pdf', MOBILE_ASSETS_DIR);
    } catch (e) {
      pdfBeforeFonts = failure(e);
    }
    for (const [name, base64] of Object.entries(input.fontsBase64)) {
      vfs.registerAsset(`${MOBILE_ASSETS_DIR}/fonts/${name}`, Buffer.from(base64, 'base64'));
    }

    const pdf = await renderExport(data, 'pdf', MOBILE_ASSETS_DIR);
    const csv = await renderExport(data, 'csv', MOBILE_ASSETS_DIR);
    const txt = await renderExport(data, 'txt', MOBILE_ASSETS_DIR);
    const json = await renderExport(data, 'json', MOBILE_ASSETS_DIR);
    return {
      sqlInitBeforeWasm,
      pdfBeforeFonts,
      entriesJson,
      containerBase64: sealed.toString('base64'),
      fontFamilies: Object.keys(resolvePdfFontSet(MOBILE_ASSETS_DIR)).sort(),
      pdfBase64: Buffer.from(pdf).toString('base64'),
      csvBase64: Buffer.from(csv).toString('base64'),
      txtBase64: Buffer.from(txt).toString('base64'),
      jsonBase64: Buffer.from(json).toString('base64'),
    };
  } finally {
    db.close();
  }
}
