/**
 * `node:url` of the Android core: the WHATWG classes are the platform's own; the file-URL helpers
 * (used only by server/src/util/paths.ts, which ./paths.ts replaces) throw when called.
 */
import { stubFunction } from './unavailable';

const WhatwgURL = globalThis.URL;
const WhatwgURLSearchParams = globalThis.URLSearchParams;

export const fileURLToPath = stubFunction('url', 'fileURLToPath');
export const pathToFileURL = stubFunction('url', 'pathToFileURL');
export { WhatwgURL as URL, WhatwgURLSearchParams as URLSearchParams };

export default { URL: WhatwgURL, URLSearchParams: WhatwgURLSearchParams, fileURLToPath, pathToFileURL };
