/**
 * QR encoder tests. The symbols are checked against references derived here by
 * independent means - a separate GF(256) implementation (log/antilog tables and
 * polynomial long division instead of the encoder's carry-less multiplication),
 * bit strings built by hand, the tables printed in ISO/IEC 18004 and an
 * independent reader that locates the function patterns, reads the format
 * information, unmasks the symbol and walks the codewords back out.
 */
import { describe, expect, it } from 'vitest';
import { encodeQr, qrByteCapacity, qrDataBytes, qrReedSolomon, qrSvgPath, qrVersionFor, qrViewSize, type QrCode } from './qr';

// ---------------------------------------------------------------------------
// Independent GF(256) arithmetic (log / antilog tables, primitive 0x11D)
// ---------------------------------------------------------------------------

const EXP: number[] = [];
const LOG: number[] = new Array(256).fill(0);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Generator polynomial prod (x - a^i), full coefficient list, highest degree first. */
function generator(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

/** Remainder of data(x) * x^n divided by the generator (polynomial long division). */
function rsRemainder(data: readonly number[], n: number): number[] {
  const g = generator(n);
  const buf = [...data, ...new Array<number>(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = buf[i];
    if (coef !== 0) for (let j = 0; j < g.length; j++) buf[i + j] ^= mul(g[j], coef);
  }
  return buf.slice(data.length);
}

/** Remainder of a binary polynomial division on bit strings (for the BCH codes). */
function bchRemainder(bits: string, generatorBits: string): string {
  const buf = (bits + '0'.repeat(generatorBits.length - 1)).split('').map(Number);
  for (let i = 0; i < bits.length; i++) {
    if (buf[i] === 1) for (let j = 0; j < generatorBits.length; j++) buf[i + j] ^= Number(generatorBits[j]);
  }
  return buf.slice(bits.length).join('');
}

// ---------------------------------------------------------------------------
// Independent reader
// ---------------------------------------------------------------------------

/** Standard table: 15-bit format strings (after masking with 101010000010010) for level M, masks 0-7. */
const FORMAT_M = [
  '101010000010010',
  '101000100100101',
  '101111001111100',
  '101101101001011',
  '100010111111001',
  '100000011001110',
  '100111110010111',
  '100101010100000',
];

/** Standard table: 18-bit version information strings. */
const VERSION_INFO: Record<number, string> = {
  7: '000111110010010100',
  8: '001000010110111100',
  9: '001001101010011001',
  10: '001010010011010011',
};

/** Alignment pattern centre coordinates for the versions exercised here (standard annex E). */
const ALIGN: Record<number, number[]> = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 8: [6, 24, 42], 10: [6, 28, 50] };

/** Block layout at level M for the versions exercised here: [ec per block, data length of each block]. */
const BLOCKS_M: Record<number, [number, number[]]> = {
  1: [10, [16]],
  2: [16, [28]],
  3: [26, [44]],
  4: [18, [32, 32]],
  5: [24, [43, 43]],
  6: [16, [27, 27, 27, 27]],
  8: [22, [38, 38, 39, 39]],
  10: [26, [43, 43, 43, 43, 44]],
};

/** The standard's mask conditions, i = row, j = column. */
const MASKS: ((i: number, j: number) => boolean)[] = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (_i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0,
];

/** Which modules are not data modules, derived from the standard's layout description. */
function functionMap(version: number): boolean[][] {
  const size = 17 + 4 * version;
  const f = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fill = (r0: number, r1: number, c0: number, c1: number) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) f[r][c] = true;
  };
  // Finder + separator + format area (+ the dark module at the bottom-left).
  fill(0, 8, 0, 8);
  fill(0, 8, size - 8, size - 1);
  fill(size - 8, size - 1, 0, 8);
  // Timing patterns.
  fill(6, 6, 0, size - 1);
  fill(0, size - 1, 6, 6);
  // Alignment patterns.
  const a = ALIGN[version];
  for (const r of a) {
    for (const c of a) {
      const nearFinder = (r < 9 && c < 9) || (r < 9 && c > size - 10) || (r > size - 10 && c < 9);
      if (!nearFinder) fill(r - 2, r + 2, c - 2, c + 2);
    }
  }
  // Version information.
  if (version >= 7) {
    fill(0, 5, size - 11, size - 9);
    fill(size - 11, size - 9, 0, 5);
  }
  return f;
}

const bit = (qr: QrCode, r: number, c: number) => (qr.modules[r][c] ? '1' : '0');

/** Both copies of the format information, most significant bit first. */
function readFormat(qr: QrCode): [string, string] {
  const n = qr.size;
  let a = '';
  for (const c of [0, 1, 2, 3, 4, 5, 7, 8]) a += bit(qr, 8, c);
  for (const r of [7, 5, 4, 3, 2, 1, 0]) a += bit(qr, r, 8);
  let b = '';
  for (let r = n - 1; r >= n - 7; r--) b += bit(qr, r, 8);
  for (let c = n - 8; c <= n - 1; c++) b += bit(qr, 8, c);
  return [a, b];
}

/** Both copies of the version information, most significant bit first. */
function readVersion(qr: QrCode): [string, string] {
  const n = qr.size;
  let bottomLeft = '';
  let topRight = '';
  for (let i = 17; i >= 0; i--) {
    bottomLeft += bit(qr, n - 11 + (i % 3), Math.floor(i / 3));
    topRight += bit(qr, Math.floor(i / 3), n - 11 + (i % 3));
  }
  return [bottomLeft, topRight];
}

/** Every data-region module in reading order (two-column zigzag from the bottom right). */
function readingOrder(version: number): [number, number][] {
  const size = 17 + 4 * version;
  const f = functionMap(version);
  const out: [number, number][] = [];
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    const rows = Array.from({ length: size }, (_, k) => (up ? size - 1 - k : k));
    for (const r of rows) for (const c of [col, col - 1]) if (!f[r][c]) out.push([r, c]);
    up = !up;
  }
  return out;
}

interface Decoded {
  ecLevelBits: string;
  mask: number;
  codewords: number[];
}

function decode(qr: QrCode): Decoded {
  const [format] = readFormat(qr);
  const raw = [...format].map((b, i) => Number(b) ^ Number('101010000010010'[i])).join('');
  const ecLevelBits = raw.slice(0, 2);
  const mask = parseInt(raw.slice(2, 5), 2);
  const bits: number[] = [];
  for (const [r, c] of readingOrder(qr.version)) bits.push(Number(qr.modules[r][c] !== MASKS[mask](r, c)));
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) codewords.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  return { ecLevelBits, mask, codewords };
}

/** Splits interleaved codewords back into blocks. */
function deinterleave(codewords: number[], ecPerBlock: number, dataLengths: number[]) {
  const blocks = dataLengths.map(() => ({ data: [] as number[], ec: [] as number[] }));
  let k = 0;
  const longest = Math.max(...dataLengths);
  for (let i = 0; i < longest; i++) {
    for (let b = 0; b < blocks.length; b++) if (i < dataLengths[b]) blocks[b].data.push(codewords[k++]);
  }
  for (let i = 0; i < ecPerBlock; i++) for (const block of blocks) block.ec.push(codewords[k++]);
  return blocks;
}

/** Byte-mode payload parsed from the data codewords. */
function parseByteMode(data: number[], version: number): Uint8Array {
  const bits = data.map((b) => b.toString(2).padStart(8, '0')).join('');
  expect(bits.slice(0, 4)).toBe('0100');
  const countLength = version <= 9 ? 8 : 16;
  const count = parseInt(bits.slice(4, 4 + countLength), 2);
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) out[i] = parseInt(bits.slice(4 + countLength + i * 8, 12 + countLength + i * 8), 2);
  return out;
}

const FINDER = ['1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111'];

function expectFinder(qr: QrCode, top: number, left: number) {
  for (let r = 0; r < 7; r++) {
    let row = '';
    for (let c = 0; c < 7; c++) row += bit(qr, top + r, left + c);
    expect(row, `finder row ${top + r}`).toBe(FINDER[r]);
  }
}

function expectStructure(qr: QrCode) {
  const n = qr.size;
  expect(n).toBe(17 + 4 * qr.version);
  expect(qr.modules).toHaveLength(n);
  for (const row of qr.modules) expect(row).toHaveLength(n);
  expectFinder(qr, 0, 0);
  expectFinder(qr, 0, n - 7);
  expectFinder(qr, n - 7, 0);
  // Separators: light border around each finder.
  for (let i = 0; i < 8; i++) {
    expect(bit(qr, 7, i)).toBe('0');
    expect(bit(qr, i, 7)).toBe('0');
    expect(bit(qr, 7, n - 1 - i)).toBe('0');
    expect(bit(qr, i, n - 8)).toBe('0');
    expect(bit(qr, n - 8, i)).toBe('0');
    expect(bit(qr, n - 1 - i, 7)).toBe('0');
  }
  // Timing patterns: alternate, dark on even positions.
  for (let i = 8; i <= n - 9; i++) {
    expect(bit(qr, 6, i), `timing row col ${i}`).toBe(i % 2 === 0 ? '1' : '0');
    expect(bit(qr, i, 6), `timing col row ${i}`).toBe(i % 2 === 0 ? '1' : '0');
  }
  // Dark module at (4V + 9, 8).
  expect(bit(qr, 4 * qr.version + 9, 8)).toBe('1');
  // Alignment patterns: dark centre, light ring, dark border.
  const a = ALIGN[qr.version];
  if (a) {
    for (const r of a) {
      for (const c of a) {
        const nearFinder = (r < 9 && c < 9) || (r < 9 && c > n - 10) || (r > n - 10 && c < 9);
        if (nearFinder) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const ring = Math.max(Math.abs(dr), Math.abs(dc));
            expect(bit(qr, r + dr, c + dc)).toBe(ring === 1 ? '0' : '1');
          }
        }
      }
    }
  }
  // Format information: both copies agree, level M, BCH-valid, as in the standard's table.
  const [f1, f2] = readFormat(qr);
  expect(f1).toBe(f2);
  expect(f1).toBe(FORMAT_M[qr.mask]);
  const unmasked = [...f1].map((b, i) => Number(b) ^ Number('101010000010010'[i])).join('');
  expect(unmasked.slice(0, 2)).toBe('00'); // M
  expect(parseInt(unmasked.slice(2, 5), 2)).toBe(qr.mask);
  expect(unmasked.slice(5)).toBe(bchRemainder(unmasked.slice(0, 5), '10100110111'));
  // Version information from version 7.
  if (qr.version >= 7) {
    const [v1, v2] = readVersion(qr);
    expect(v1).toBe(v2);
    expect(v1).toBe(VERSION_INFO[qr.version]);
    const six = qr.version.toString(2).padStart(6, '0');
    expect(v1).toBe(six + bchRemainder(six, '1111100100101'));
  }
}

/** Decodes a level-M symbol completely and returns its byte payload (checking every EC block). */
function roundTrip(qr: QrCode): Uint8Array {
  expectStructure(qr);
  const decoded = decode(qr);
  expect(decoded.ecLevelBits).toBe('00');
  expect(decoded.mask).toBe(qr.mask);
  const [ecPerBlock, lengths] = BLOCKS_M[qr.version];
  const total = lengths.reduce((s, l) => s + l + ecPerBlock, 0);
  const blocks = deinterleave(decoded.codewords.slice(0, total), ecPerBlock, lengths);
  for (const block of blocks) expect(block.ec).toEqual(rsRemainder(block.data, ecPerBlock));
  return parseByteMode(
    blocks.flatMap((b) => b.data),
    qr.version,
  );
}

const hex = (s: string) => s.split(/\s+/).filter(Boolean).map((h) => parseInt(h, 16));

// ---------------------------------------------------------------------------

describe('Reed-Solomon error correction', () => {
  it("reproduces the standard's worked example (\"01234567\", version 1-M, annex I)", () => {
    const data = hex('10 20 0C 56 61 80 EC 11 EC 11 EC 11 EC 11 EC 11');
    const ec = hex('A5 24 D4 C1 ED 36 C7 87 2C 55');
    expect(rsRemainder(data, 10)).toEqual(ec);
    expect(qrReedSolomon(data, 10)).toEqual(ec);
  });

  it('agrees with the independent implementation for every block size used by versions 1-10', () => {
    const sample = Array.from({ length: 44 }, (_, i) => (i * 37 + 11) & 0xff);
    for (const n of [7, 10, 13, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30]) {
      expect(qrReedSolomon(sample, n), `ec ${n}`).toEqual(rsRemainder(sample, n));
    }
  });
});

describe('encodeQr - "HELLO WORLD" at level M', () => {
  const text = 'HELLO WORLD';
  // Data codewords built by hand: 0100 | 00001011 | 11 bytes | 0000 terminator | pad EC 11 EC.
  const handBits =
    '0100' + (11).toString(2).padStart(8, '0') + [...text].map((ch) => ch.charCodeAt(0).toString(2).padStart(8, '0')).join('') + '0000';
  const handData: number[] = [];
  for (let i = 0; i < handBits.length; i += 8) handData.push(parseInt(handBits.slice(i, i + 8).padEnd(8, '0'), 2));
  while (handData.length < 16) handData.push(handData.length % 2 === 1 ? 0xec : 0x11);

  it('builds the data codewords of the standard bit stream', () => {
    expect(handData).toEqual(hex('40 B4 84 54 C4 C4 F2 05 74 F5 24 C4 40 EC 11 EC'));
    expect(qrDataBytes(new TextEncoder().encode(text), 1, 'M')).toEqual(handData);
  });

  it('draws a version-1 symbol whose patterns, format bits and codewords match the reference', () => {
    const qr = encodeQr(text);
    expect(qr.version).toBe(1);
    expect(qr.size).toBe(21);
    expect(qr.ecLevel).toBe('M');
    expectStructure(qr);
    const { codewords, mask } = decode(qr);
    expect(mask).toBe(qr.mask);
    expect(codewords).toHaveLength(26); // version 1 has no remainder bits
    expect(codewords.slice(0, 16)).toEqual(handData);
    expect(codewords.slice(16)).toEqual(rsRemainder(handData, 10));
  });

  it('produces a valid symbol with every forced mask, and picks one of them by penalty', () => {
    for (let mask = 0; mask < 8; mask++) {
      const qr = encodeQr(text, { mask });
      expect(qr.mask).toBe(mask);
      expect(new TextDecoder().decode(roundTrip(qr))).toBe(text);
    }
    const chosen = encodeQr(text);
    expect(chosen.modules).toEqual(encodeQr(text, { mask: chosen.mask }).modules);
  });
});

describe('encodeQr - longer payloads', () => {
  const cases: [string, string, number][] = [
    ['the diary URL', 'https://yourpersonaldiary.duckdns.org', 3],
    ['a URL with a port (two blocks)', 'https://yourpersonaldiary.duckdns.org:8443/', 4],
    ['Hebrew text (UTF-8)', 'היומן האישי שלך - Your Personal Diary', 4],
    ['70 bytes', 'y'.repeat(70), 5],
    ['100 bytes (4 blocks)', 'x'.repeat(100), 6],
    ['150 bytes (two block groups, version information)', 'https://example.org/' + 'a'.repeat(130), 8],
    ['200 bytes (16-bit character count)', 'b'.repeat(200), 10],
  ];
  for (const [name, text, version] of cases) {
    it(`round-trips ${name} at version ${version}`, () => {
      const qr = encodeQr(text);
      expect(qr.version).toBe(version);
      expect(new TextDecoder().decode(roundTrip(qr))).toBe(text);
    });
  }

  it('respects minVersion and reports the byte capacity per version', () => {
    expect(qrByteCapacity(1, 'M')).toBe(14);
    expect(qrByteCapacity(3, 'M')).toBe(42);
    expect(qrByteCapacity(10, 'M')).toBe(213);
    expect(qrVersionFor(14)).toBe(1);
    expect(qrVersionFor(15)).toBe(2);
    const qr = encodeQr('HELLO WORLD', { minVersion: 2 });
    expect(qr.version).toBe(2);
    expect(new TextDecoder().decode(roundTrip(qr))).toBe('HELLO WORLD');
  });

  it('throws a RangeError for text that does not fit into version 10', () => {
    expect(() => encodeQr('z'.repeat(214))).toThrow(RangeError);
    expect(() => encodeQr('z'.repeat(213))).not.toThrow();
    expect(() => encodeQr('abc', { mask: 8 })).toThrow(RangeError);
  });
});

describe('qrSvgPath', () => {
  it('covers exactly the dark modules, offset by the quiet zone', () => {
    const qr = encodeQr('https://yourpersonaldiary.duckdns.org');
    const margin = 4;
    expect(qrViewSize(qr, margin)).toBe(qr.size + 8);
    const covered = Array.from({ length: qr.size }, () => new Array<boolean>(qr.size).fill(false));
    const re = /M(\d+) (\d+)h(\d+)v1h-(\d+)z/g;
    const path = qrSvgPath(qr, margin);
    let m: RegExpExecArray | null;
    let consumed = 0;
    while ((m = re.exec(path))) {
      consumed += m[0].length;
      const [x, y, w, back] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      expect(back).toBe(w);
      for (let k = 0; k < w; k++) {
        expect(covered[y - margin][x - margin + k]).toBe(false);
        covered[y - margin][x - margin + k] = true;
      }
    }
    expect(consumed).toBe(path.length);
    expect(covered).toEqual(qr.modules);
  });
});
