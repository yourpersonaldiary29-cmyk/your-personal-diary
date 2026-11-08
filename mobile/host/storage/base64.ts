/**
 * base64 <-> bytes for the Capacitor bridge (binary data crosses it as base64 text).
 * Works on `btoa` / `atob`, which every WebView has, in slices so that a file of several
 * megabytes neither builds one giant argument list nor one giant intermediate string per byte.
 */

/** A multiple of 3, so the base64 of the slices can simply be concatenated. */
const ENCODE_SLICE = 3 * 8192;

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let offset = 0; offset < bytes.byteLength; offset += ENCODE_SLICE) {
    const slice = bytes.subarray(offset, Math.min(offset + ENCODE_SLICE, bytes.byteLength));
    out += btoa(String.fromCharCode.apply(null, slice as unknown as number[]));
  }
  return out;
}

/** Decodes base64 (a `data:` URL prefix and white space are tolerated). Throws on anything else. */
export function base64ToBytes(text: string): Uint8Array {
  const comma = text.startsWith('data:') ? text.indexOf(',') : -1;
  const clean = (comma >= 0 ? text.slice(comma + 1) : text).replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
