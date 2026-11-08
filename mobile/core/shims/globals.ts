/**
 * The Node globals of the Android core: `Buffer`, `process`, `setImmediate` / `clearImmediate`.
 *
 * Two mechanisms, both driven by mobile/core/alias-plugin.ts:
 *  1. Server modules (server/src, shared) get these as MODULE imports: the plugin prepends
 *     `import { Buffer, process, ... } from '.../shims/globals'` to every module that names one of
 *     them. So the server code always runs on the polyfills - also under vitest, where Node's own
 *     Buffer exists - and nothing depends on the import order of the worker entry.
 *  2. Third-party code and mobile/core code that expects real globals: importing this module
 *     installs each global that is MISSING (a Web Worker has none of them). Existing globals are
 *     never replaced, so loading it under Node changes nothing.
 * The worker entry (WP-5) imports this module first.
 */
import { Buffer } from './buffer';
import { process } from './process';

type ImmediateCallback = (...args: unknown[]) => void;

/** Handle of a pending `setImmediate` (opaque; pass it to `clearImmediate`). */
export interface MobileImmediate {
  readonly timer: ReturnType<typeof setTimeout>;
}

function isMobileImmediate(value: unknown): value is MobileImmediate {
  return typeof value === 'object' && value !== null && 'timer' in value;
}

/** Runs `callback` in a later macrotask (after the current one finished and its answer was posted). */
function mobileSetImmediate(callback: ImmediateCallback, ...args: unknown[]): MobileImmediate {
  return { timer: setTimeout(callback, 0, ...args) };
}

function mobileClearImmediate(handle: unknown): void {
  if (isMobileImmediate(handle)) clearTimeout(handle.timer);
}

const setImmediateShim = mobileSetImmediate as unknown as typeof globalThis.setImmediate;
const clearImmediateShim = mobileClearImmediate as unknown as typeof globalThis.clearImmediate;

const scope = globalThis as unknown as Record<string, unknown>;
if (typeof scope.Buffer === 'undefined') scope.Buffer = Buffer;
if (typeof scope.process === 'undefined') scope.process = process;
if (typeof scope.setImmediate === 'undefined') scope.setImmediate = setImmediateShim;
if (typeof scope.clearImmediate === 'undefined') scope.clearImmediate = clearImmediateShim;

export { Buffer, process, setImmediateShim as setImmediate, clearImmediateShim as clearImmediate };
