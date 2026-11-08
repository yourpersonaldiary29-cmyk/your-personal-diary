/**
 * The boot-time assets inside the core: the host fetched the SQLite WebAssembly module and the
 * PDF fonts (mobile/host/assets.ts) and transferred the bytes (CoreAssetsMessage); here they are
 * handed to the modules that need them, before the core boots:
 *
 *   sql-wasm.wasm   -> provideSqlWasm(bytes)            (mobile/core/shims/sqljs.ts)
 *   <font>.ttf      -> vfs.registerAsset('/assets/fonts/<font>', bytes)
 *                      (where server/src/export/fonts.ts looks for them: `<assetsDir>/fonts`)
 */
import { CORE_FONT_FILES, CORE_FONTS_DIR, type CoreAssetBytes } from '../shared/transport';
import { MOBILE_ASSETS_DIR } from './shims/paths';
import { provideSqlWasm } from './shims/sqljs';
import type { Vfs } from './vfs';

/** The virtual path of a font file. */
export function fontAssetPath(fileName: string, assetsDir: string = MOBILE_ASSETS_DIR): string {
  return `${assetsDir}/${CORE_FONTS_DIR}/${fileName}`;
}

/** The font files that are missing from `assets` (all of CORE_FONT_FILES must be there). */
export function missingFonts(assets: Pick<CoreAssetBytes, 'fonts'>): string[] {
  return CORE_FONT_FILES.filter((name) => !(name in assets.fonts) || assets.fonts[name].byteLength === 0);
}

/**
 * Registers the assets. Throws when the wasm is empty or a bundled font is missing: without them
 * the diary could not be opened or exported, so the core must not report `ready`.
 */
export function registerCoreAssets(vfs: Vfs, assets: CoreAssetBytes, assetsDir: string = MOBILE_ASSETS_DIR): void {
  if (!assets.sqlWasm || assets.sqlWasm.byteLength === 0) throw new Error('core assets: sql-wasm.wasm is missing or empty');
  const missing = missingFonts(assets);
  if (missing.length) throw new Error(`core assets: font files missing: ${missing.join(', ')}`);
  provideSqlWasm(new Uint8Array(assets.sqlWasm));
  for (const name of CORE_FONT_FILES) vfs.registerAsset(fontAssetPath(name, assetsDir), new Uint8Array(assets.fonts[name]));
}
