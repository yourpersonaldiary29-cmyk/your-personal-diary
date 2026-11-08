/**
 * `sql.js` of the Android core: the package's browser build (no Node code; the WebAssembly binary
 * is byte-identical to the one the desktop server loads), started with a `wasmBinary` the host
 * supplies instead of a file location.
 *
 * server/src/db/database.ts calls `initSqlJs({ locateFile })`; the call shape stays, `locateFile`
 * is ignored (there is no file to locate - a Worker started from a blob: URL must not fetch).
 *
 * Boot order (WP-5): the host reads sql-wasm.wasm from the app assets on the main thread, posts
 * the bytes to the worker, the worker calls `provideSqlWasm(bytes)` - before the first request.
 */
import initSqlJsBrowser from 'mobile-vendor:sql.js';

type WasmBytes = ArrayBuffer | Uint8Array;

let wasmBinary: WasmBytes | null = null;

/** Hands the content of sql-wasm.wasm to the core. Call once at boot, before any database is opened. */
export function provideSqlWasm(bytes: WasmBytes): void {
  if (!(bytes instanceof ArrayBuffer) && !(bytes instanceof Uint8Array)) {
    throw new TypeError('provideSqlWasm: expected the bytes of sql-wasm.wasm (ArrayBuffer or Uint8Array)');
  }
  if (bytes.byteLength === 0) throw new RangeError('provideSqlWasm: sql-wasm.wasm is empty');
  wasmBinary = bytes;
}

export function hasSqlWasm(): boolean {
  return wasmBinary !== null;
}

/** The config server/src passes (only its shape matters here). */
export interface SqlJsConfig {
  locateFile?: unknown;
  wasmBinary?: WasmBytes;
}

/**
 * Same call shape as the `sql.js` default export. Throws synchronously when the host has not
 * supplied the WebAssembly binary yet - db/database.ts then caches nothing and a later call works.
 */
export default function initSqlJs(config: SqlJsConfig = {}): Promise<unknown> {
  const binary = config.wasmBinary ?? wasmBinary;
  if (!binary) {
    throw new Error('sql.js: the WebAssembly binary was not provided - call provideSqlWasm(bytes) at boot (mobile/core/shims/sqljs.ts)');
  }
  return initSqlJsBrowser({ wasmBinary: binary });
}
