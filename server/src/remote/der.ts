/**
 * A tiny DER (ASN.1 Distinguished Encoding Rules) encoder - just enough to build a PKCS#10
 * certificate signing request (csr.ts) without any dependency. Also used by the tests to build
 * X.509 certificates for the mock ACME server.
 *
 * Every helper returns the complete TLV (tag, length, value) as a Buffer.
 */

/** DER length octets: short form below 128, long form (0x80 | n, then n big-endian bytes) above. */
export function derLength(length: number): Buffer {
  if (!Number.isInteger(length) || length < 0) throw new RangeError(`bad DER length ${length}`);
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  let n = length;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n = Math.floor(n / 256);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/** Tag + length + content. */
export function tlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

export const TAG = {
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  UTF8_STRING: 0x0c,
  PRINTABLE_STRING: 0x13,
  IA5_STRING: 0x16,
  UTC_TIME: 0x17,
  GENERALIZED_TIME: 0x18,
  SEQUENCE: 0x30,
  SET: 0x31,
} as const;

export function derSequence(...items: Buffer[]): Buffer {
  return tlv(TAG.SEQUENCE, Buffer.concat(items));
}

/** SET OF: DER requires the encodings sorted in ascending byte order. */
export function derSet(...items: Buffer[]): Buffer {
  const sorted = [...items].sort(Buffer.compare);
  return tlv(TAG.SET, Buffer.concat(sorted));
}

/**
 * INTEGER from a non-negative number / bigint, or from unsigned big-endian bytes (serial numbers).
 * Leading zero bytes are stripped and a 0x00 is prepended when the high bit is set (so the value
 * stays positive).
 */
export function derInteger(value: number | bigint | Buffer): Buffer {
  let bytes: Buffer;
  if (Buffer.isBuffer(value)) {
    bytes = Buffer.from(value);
  } else {
    let n = BigInt(value);
    if (n < 0n) throw new RangeError('negative DER integers are not supported');
    const out: number[] = [];
    do {
      out.unshift(Number(n & 0xffn));
      n >>= 8n;
    } while (n > 0n);
    bytes = Buffer.from(out);
  }
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start++;
  bytes = bytes.subarray(start);
  if (bytes.length === 0) bytes = Buffer.from([0]);
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
  return tlv(TAG.INTEGER, bytes);
}

/** OBJECT IDENTIFIER from dotted notation ('2.5.4.3'). */
export function derOid(oid: string): Buffer {
  const parts = oid.split('.').map((p) => {
    if (!/^\d+$/.test(p)) throw new RangeError(`bad OID ${oid}`);
    return BigInt(p);
  });
  if (parts.length < 2) throw new RangeError(`bad OID ${oid}`);
  const out: number[] = [];
  const encodeArc = (arc: bigint) => {
    const chunk: number[] = [Number(arc & 0x7fn)];
    arc >>= 7n;
    while (arc > 0n) {
      chunk.unshift(Number(arc & 0x7fn) | 0x80);
      arc >>= 7n;
    }
    out.push(...chunk);
  };
  encodeArc(parts[0] * 40n + parts[1]);
  for (const arc of parts.slice(2)) encodeArc(arc);
  return tlv(TAG.OID, Buffer.from(out));
}

export function derNull(): Buffer {
  return Buffer.from([TAG.NULL, 0x00]);
}

export function derBoolean(value: boolean): Buffer {
  return tlv(TAG.BOOLEAN, Buffer.from([value ? 0xff : 0x00]));
}

export function derUtf8String(s: string): Buffer {
  return tlv(TAG.UTF8_STRING, Buffer.from(s, 'utf8'));
}

export function derPrintableString(s: string): Buffer {
  return tlv(TAG.PRINTABLE_STRING, Buffer.from(s, 'ascii'));
}

export function derIa5String(s: string): Buffer {
  return tlv(TAG.IA5_STRING, Buffer.from(s, 'ascii'));
}

export function derOctetString(content: Buffer): Buffer {
  return tlv(TAG.OCTET_STRING, content);
}

/** BIT STRING with 0 unused bits (keys, signatures). */
export function derBitString(content: Buffer): Buffer {
  return tlv(TAG.BIT_STRING, Buffer.concat([Buffer.from([0x00]), content]));
}

/** Context-specific tag [n]: constructed (0xA0 | n, EXPLICIT / constructed IMPLICIT) or primitive (0x80 | n). */
export function derContext(n: number, content: Buffer, constructed = true): Buffer {
  if (n < 0 || n > 30) throw new RangeError(`bad context tag ${n}`);
  return tlv((constructed ? 0xa0 : 0x80) | n, content);
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTCTime 'YYMMDDHHMMSSZ' (years 1950-2049). */
export function derUtcTime(date: Date): Buffer {
  const y = date.getUTCFullYear();
  if (y < 1950 || y > 2049) throw new RangeError('UTCTime covers 1950-2049 only');
  const s =
    two(y % 100) +
    two(date.getUTCMonth() + 1) +
    two(date.getUTCDate()) +
    two(date.getUTCHours()) +
    two(date.getUTCMinutes()) +
    two(date.getUTCSeconds()) +
    'Z';
  return tlv(TAG.UTC_TIME, Buffer.from(s, 'ascii'));
}

/** GeneralizedTime 'YYYYMMDDHHMMSSZ'. */
export function derGeneralizedTime(date: Date): Buffer {
  const s =
    String(date.getUTCFullYear()).padStart(4, '0') +
    two(date.getUTCMonth() + 1) +
    two(date.getUTCDate()) +
    two(date.getUTCHours()) +
    two(date.getUTCMinutes()) +
    two(date.getUTCSeconds()) +
    'Z';
  return tlv(TAG.GENERALIZED_TIME, Buffer.from(s, 'ascii'));
}

/** RFC 5280 validity time: UTCTime through 2049, GeneralizedTime after. */
export function derTime(date: Date): Buffer {
  const y = date.getUTCFullYear();
  return y >= 1950 && y <= 2049 ? derUtcTime(date) : derGeneralizedTime(date);
}

// PEM / base64url -------------------------------------------------------------------------------

/** PEM armour: base64 in 64-character lines between BEGIN/END markers. */
export function toPem(label: string, der: Buffer): string {
  const b64 = der.toString('base64');
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

/** Every PEM block with the given label (in order), decoded to DER. */
export function pemBlocks(pem: string, label = 'CERTIFICATE'): Buffer[] {
  const re = new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`, 'g');
  const out: Buffer[] = [];
  for (const m of pem.matchAll(re)) out.push(Buffer.from(m[1].replace(/\s+/g, ''), 'base64'));
  return out;
}

/** Every complete PEM block (text, including markers) with the given label. */
export function splitPem(pem: string, label = 'CERTIFICATE'): string[] {
  const re = new RegExp(`-----BEGIN ${label}-----[\\s\\S]*?-----END ${label}-----`, 'g');
  return [...pem.matchAll(re)].map((m) => `${m[0]}\n`);
}

/** RFC 4648 section 5 base64url without padding. */
export function base64url(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
