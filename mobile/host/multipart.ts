/**
 * multipart/form-data encoding of a `FormData` request body for the diary core.
 *
 * On the desktop the browser encodes an upload (restore from a backup file) while `fetch` sends
 * it. On the phone no HTTP request exists - the body travels to the core worker as bytes - so the
 * host encodes it itself, the way the HTML standard describes it ("multipart/form-data encoding
 * algorithm"): the core then parses exactly what the desktop server receives.
 */

const CRLF = '\r\n';

/** Bytes of a Blob / File (`arrayBuffer()` where the engine has it, FileReader otherwise). */
export function readBlobBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('cannot read the file'));
    reader.readAsArrayBuffer(blob);
  });
}

/** A boundary that cannot appear in a field name and practically never in a file. */
export function makeBoundary(): string {
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  return `----mpdFormBoundary${Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Field and file names: line breaks and double quotes are percent-encoded (HTML standard). */
function escapeName(name: string): string {
  return name.replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/"/g, '%22');
}

/** Text values: every line break becomes CRLF (HTML standard). */
function normaliseLineBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, CRLF);
}

export interface EncodedMultipart {
  /** `multipart/form-data; boundary=...` - the Content-Type the request must carry. */
  contentType: string;
  bytes: ArrayBuffer;
}

/** Encodes `form` as a multipart/form-data body. */
export async function encodeMultipart(form: FormData, boundary: string = makeBoundary()): Promise<EncodedMultipart> {
  const encoder = new TextEncoder();
  const entries: Array<[string, FormDataEntryValue]> = [];
  form.forEach((value, name) => {
    entries.push([name, value]);
  });

  const parts: Uint8Array[] = [];
  for (const [name, value] of entries) {
    let head = `--${boundary}${CRLF}Content-Disposition: form-data; name="${escapeName(name)}"`;
    if (typeof value === 'string') {
      parts.push(encoder.encode(`${head}${CRLF}${CRLF}${normaliseLineBreaks(value)}${CRLF}`));
    } else {
      head += `; filename="${escapeName(value.name)}"${CRLF}Content-Type: ${value.type || 'application/octet-stream'}`;
      parts.push(encoder.encode(`${head}${CRLF}${CRLF}`), new Uint8Array(await readBlobBytes(value)), encoder.encode(CRLF));
    }
  }
  parts.push(encoder.encode(`--${boundary}--${CRLF}`));

  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return { contentType: `multipart/form-data; boundary=${boundary}`, bytes: bytes.buffer };
}
