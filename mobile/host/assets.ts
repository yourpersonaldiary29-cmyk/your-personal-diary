/**
 * Loads the boot-time assets of the diary core on the main thread: the SQLite WebAssembly module
 * and the PDF fonts. The mobile build ships them as web assets under `core-assets/`
 * (mobile/vite.config.mobile.ts copies them from server/node_modules/sql.js and
 * src-tauri/resources/server/fonts), so they are fetched same-origin - allowed by the CSP
 * (`connect-src 'self'`) and served by the WebView's asset loader, which a Worker started from a
 * blob: URL could not use. The bytes are then transferred to the worker (core-client.ts
 * `sendAssets`).
 */
import { CORE_ASSETS_DIR, CORE_FONT_FILES, CORE_FONTS_DIR, CORE_SQL_WASM_FILE, type CoreAssetBytes } from '../shared/transport';

export type FetchLike = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'arrayBuffer'>>;

export interface LoadAssetsOptions {
  /** `fetch` (tests pass a fake). */
  fetch?: FetchLike;
  /** URL prefix of the web assets. Default: '/' (the app is served from the root). */
  base?: string;
}

/** The URL of one core asset. */
export function coreAssetUrl(file: string, base = '/'): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${CORE_ASSETS_DIR}/${file}`;
}

async function fetchBytes(fetchFn: FetchLike, url: string): Promise<ArrayBuffer> {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchFn(url);
  } catch (e) {
    throw new Error(`core asset ${url} could not be fetched: ${(e as Error)?.message ?? e}`);
  }
  if (!response.ok) throw new Error(`core asset ${url} answered HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error(`core asset ${url} is empty`);
  return bytes;
}

/** Fetches every asset (in parallel). Rejects when one is missing: the core cannot start without them. */
export async function loadCoreAssets(options: LoadAssetsOptions = {}): Promise<CoreAssetBytes> {
  const fetchFn: FetchLike = options.fetch ?? ((url) => fetch(url, { credentials: 'same-origin' }));
  const base = options.base ?? '/';
  const [sqlWasm, ...fontBytes] = await Promise.all([
    fetchBytes(fetchFn, coreAssetUrl(CORE_SQL_WASM_FILE, base)),
    ...CORE_FONT_FILES.map((name) => fetchBytes(fetchFn, coreAssetUrl(`${CORE_FONTS_DIR}/${name}`, base))),
  ]);
  const fonts: Record<string, ArrayBuffer> = {};
  CORE_FONT_FILES.forEach((name, index) => {
    fonts[name] = fontBytes[index];
  });
  return { sqlWasm, fonts };
}
