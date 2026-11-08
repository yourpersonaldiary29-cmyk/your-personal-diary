// @vitest-environment node
// Node environment: FormData, File and Response all come from the same platform implementation,
// so the encoded body can be read back with the platform's own multipart parser.
import { describe, expect, it } from 'vitest';
import { encodeMultipart, makeBoundary, readBlobBytes } from './multipart';

const BOUNDARY = '----mpdFormBoundaryTEST';

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

describe('multipart/form-data encoding of an upload', () => {
  it('writes text fields and files in the standard layout, byte for byte', async () => {
    const form = new FormData();
    form.append('mode', 'replace');
    form.append('file', new File([new Uint8Array([0, 255, 13, 10])], 'backup.mpd', { type: 'application/x-mpd' }));

    const { contentType, bytes } = await encodeMultipart(form, BOUNDARY);
    expect(contentType).toBe(`multipart/form-data; boundary=${BOUNDARY}`);
    expect(Array.from(new Uint8Array(bytes))).toEqual([
      ...utf8(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="mode"\r\n\r\nreplace\r\n`),
      ...utf8(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="backup.mpd"\r\n`),
      ...utf8('Content-Type: application/x-mpd\r\n\r\n'),
      ...[0, 255, 13, 10],
      ...utf8(`\r\n--${BOUNDARY}--\r\n`),
    ]);
  });

  it('is read back unchanged by an independent multipart parser', async () => {
    const payload = new Uint8Array(4096).map((_, i) => (i * 31) % 256);
    const form = new FormData();
    form.append('note', 'שלום עולם - مرحبا - 你好');
    form.append('empty', '');
    form.append('file', new File([payload], 'יומן אישי.mpd'));
    form.append('file', new File([], 'empty.bin', { type: 'application/octet-stream' }));

    const { contentType, bytes } = await encodeMultipart(form);
    const parsed = await new Response(bytes, { headers: { 'content-type': contentType } }).formData();

    expect(parsed.get('note')).toBe('שלום עולם - مرحبا - 你好');
    expect(parsed.get('empty')).toBe('');
    const files = parsed.getAll('file') as File[];
    expect(files.map((f) => f.name)).toEqual(['יומן אישי.mpd', 'empty.bin']);
    // A file without a type is sent as application/octet-stream, like browsers do.
    expect(files.map((f) => f.type)).toEqual(['application/octet-stream', 'application/octet-stream']);
    expect(new Uint8Array(await files[0].arrayBuffer())).toEqual(payload);
    expect(files[1].size).toBe(0);
  });

  it('escapes quotes and line breaks in names and normalises line breaks in text values', async () => {
    const form = new FormData();
    form.append('a"b\r\nc', 'one\ntwo\rthree\r\nfour');
    form.append('file', new File(['x'], 'my "diary"\n.mpd'));

    const { bytes } = await encodeMultipart(form, BOUNDARY);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('name="a%22b%0D%0Ac"\r\n\r\none\r\ntwo\r\nthree\r\nfour\r\n');
    expect(text).toContain('name="file"; filename="my %22diary%22%0A.mpd"\r\n');
  });

  it('encodes an empty form as the closing boundary only', async () => {
    const { bytes } = await encodeMultipart(new FormData(), BOUNDARY);
    expect(new TextDecoder().decode(bytes)).toBe(`--${BOUNDARY}--\r\n`);
  });

  it('makes a fresh random boundary for every body', () => {
    const first = makeBoundary();
    const second = makeBoundary();
    expect(first).toMatch(/^----mpdFormBoundary[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
  });

  it('reads a Blob through FileReader when the engine has no Blob.arrayBuffer()', async () => {
    class FakeReader {
      result: ArrayBuffer | null = null;
      error: Error | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsArrayBuffer(blob: { bytes?: number[] }): void {
        queueMicrotask(() => {
          if (blob.bytes) {
            this.result = new Uint8Array(blob.bytes).buffer;
            this.onload?.();
          } else {
            this.error = new Error('unreadable');
            this.onerror?.();
          }
        });
      }
    }
    const original = (globalThis as { FileReader?: unknown }).FileReader;
    (globalThis as { FileReader?: unknown }).FileReader = FakeReader;
    try {
      const legacyBlob = { bytes: [1, 2, 3] } as unknown as Blob;
      expect(Array.from(new Uint8Array(await readBlobBytes(legacyBlob)))).toEqual([1, 2, 3]);
      await expect(readBlobBytes({} as unknown as Blob)).rejects.toThrow('unreadable');
    } finally {
      (globalThis as { FileReader?: unknown }).FileReader = original;
    }
  });
});
