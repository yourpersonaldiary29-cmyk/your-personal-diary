/**
 * Tiny QR Code encoder (ISO/IEC 18004), no dependency.
 *
 * Scope: byte mode (the text is encoded as UTF-8), versions 1-10, all four
 * error-correction levels (the app uses M). That is up to 213 bytes at level M,
 * plenty for an https URL. Used by the Remote access card to draw the diary's
 * address as an inline SVG the owner can scan with the phone camera.
 *
 *   const qr = encodeQr('https://example.duckdns.org');   // level M, smallest version
 *   <svg viewBox={`0 0 ${qrViewSize(qr)} ${qrViewSize(qr)}`}><path d={qrSvgPath(qr)} /></svg>
 *
 * The steps follow the standard: data bit stream (mode, character count, data,
 * terminator, pad bytes) -> split into blocks -> Reed-Solomon error correction
 * per block over GF(256) (primitive polynomial x^8+x^4+x^3+x^2+1) -> interleave ->
 * function patterns (finders, separators, timing, alignment, dark module,
 * version information from version 7) -> zigzag placement -> the mask with the
 * lowest penalty (rules N1-N4) -> BCH-coded format information.
 */

export type QrEcLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrCode {
  /** 1-10. */
  version: number;
  /** Modules per side (17 + 4 * version). */
  size: number;
  ecLevel: QrEcLevel;
  /** 0-7. */
  mask: number;
  /** modules[row][column], true = dark. */
  modules: boolean[][];
}

export interface QrOptions {
  /** Error-correction level, default 'M'. */
  ecLevel?: QrEcLevel;
  /** Smallest version to use, default 1. */
  minVersion?: number;
  /** Largest version to use, default 10 (the maximum supported). */
  maxVersion?: number;
  /** Force a mask (0-7) instead of choosing the lowest-penalty one. */
  mask?: number;
}

export const QR_MIN_VERSION = 1;
export const QR_MAX_VERSION = 10;

/** Two-bit format code of each level (standard table 12: L=01, M=00, Q=11, H=10). */
const EC_FORMAT_BITS: Record<QrEcLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

/**
 * Block structure per version (index 1-10) and level:
 * [EC codewords per block, blocks in group 1, data codewords per group-1 block,
 *  blocks in group 2, data codewords per group-2 block] (standard table 9).
 */
type BlockSpec = readonly [number, number, number, number, number];
const BLOCKS: Record<QrEcLevel, readonly BlockSpec[]> = {
  L: [
    [0, 0, 0, 0, 0],
    [7, 1, 19, 0, 0],
    [10, 1, 34, 0, 0],
    [15, 1, 55, 0, 0],
    [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0],
    [18, 2, 68, 0, 0],
    [20, 2, 78, 0, 0],
    [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0],
    [18, 2, 68, 2, 69],
  ],
  M: [
    [0, 0, 0, 0, 0],
    [10, 1, 16, 0, 0],
    [16, 1, 28, 0, 0],
    [26, 1, 44, 0, 0],
    [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0],
    [18, 4, 31, 0, 0],
    [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37],
    [26, 4, 43, 1, 44],
  ],
  Q: [
    [0, 0, 0, 0, 0],
    [13, 1, 13, 0, 0],
    [22, 1, 22, 0, 0],
    [18, 2, 17, 0, 0],
    [26, 2, 24, 0, 0],
    [18, 2, 15, 2, 16],
    [24, 4, 19, 0, 0],
    [18, 2, 14, 4, 15],
    [22, 4, 18, 2, 19],
    [20, 4, 16, 4, 17],
    [24, 6, 19, 2, 20],
  ],
  H: [
    [0, 0, 0, 0, 0],
    [17, 1, 9, 0, 0],
    [28, 1, 16, 0, 0],
    [22, 2, 13, 0, 0],
    [16, 4, 9, 0, 0],
    [22, 2, 11, 2, 12],
    [28, 4, 15, 0, 0],
    [26, 4, 13, 1, 14],
    [26, 4, 14, 2, 15],
    [24, 4, 12, 4, 13],
    [28, 6, 15, 2, 16],
  ],
};

/** Row/column centres of the alignment patterns per version (standard annex E). */
const ALIGNMENT_CENTRES: readonly (readonly number[])[] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

const PAD_BYTES = [0xec, 0x11] as const;
const FORMAT_MASK = 0x5412;

// ---------------------------------------------------------------------------
// Capacity helpers
// ---------------------------------------------------------------------------

/** Number of data codewords of a version / level. */
export function qrDataCodewords(version: number, ecLevel: QrEcLevel): number {
  const [, b1, d1, b2, d2] = BLOCKS[ecLevel][version];
  return b1 * d1 + b2 * d2;
}

/** Bits of the character-count indicator in byte mode (8 up to version 9, then 16). */
function countBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

/** Largest number of bytes that fit into a version / level in byte mode. */
export function qrByteCapacity(version: number, ecLevel: QrEcLevel): number {
  return Math.floor((qrDataCodewords(version, ecLevel) * 8 - 4 - countBits(version)) / 8);
}

// ---------------------------------------------------------------------------
// Data bit stream
// ---------------------------------------------------------------------------

class BitBuffer {
  readonly bits: number[] = [];
  append(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
}

/**
 * Data codewords (before error correction) for `bytes` in byte mode:
 * mode indicator 0100, character count, the bytes, up to four terminator bits,
 * zero bits to the byte boundary, then alternating pad bytes 0xEC 0x11.
 */
export function qrDataBytes(bytes: Uint8Array, version: number, ecLevel: QrEcLevel): number[] {
  const capacityBits = qrDataCodewords(version, ecLevel) * 8;
  const buffer = new BitBuffer();
  buffer.append(0b0100, 4);
  buffer.append(bytes.length, countBits(version));
  for (const b of bytes) buffer.append(b, 8);
  if (buffer.bits.length > capacityBits) throw new RangeError('QR: data too long for this version');
  buffer.append(0, Math.min(4, capacityBits - buffer.bits.length));
  buffer.append(0, (8 - (buffer.bits.length % 8)) % 8);
  const out: number[] = [];
  for (let i = 0; i < buffer.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | buffer.bits[i + j];
    out.push(byte);
  }
  for (let i = 0; out.length < capacityBits / 8; i++) out.push(PAD_BYTES[i % 2]);
  return out;
}

// ---------------------------------------------------------------------------
// Reed-Solomon over GF(256)
// ---------------------------------------------------------------------------

/** Product of two field elements (carry-less multiplication reduced by 0x11D). */
function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/** Coefficients (highest degree first, leading 1 omitted) of prod_{i<degree} (x - a^i). */
function rsGenerator(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

/** The `ecCount` error-correction codewords of one block of data codewords. */
export function qrReedSolomon(data: readonly number[], ecCount: number): number[] {
  const divisor = rsGenerator(ecCount);
  const result = new Array<number>(ecCount).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < result.length; i++) result[i] ^= gfMultiply(divisor[i], factor);
  }
  return result;
}

/** Splits the data codewords into blocks, adds error correction and interleaves them. */
function interleave(data: readonly number[], version: number, ecLevel: QrEcLevel): number[] {
  const [ecCount, b1, d1, b2, d2] = BLOCKS[ecLevel][version];
  const blocks: { data: number[]; ec: number[] }[] = [];
  let offset = 0;
  for (let i = 0; i < b1 + b2; i++) {
    const length = i < b1 ? d1 : d2;
    const part = data.slice(offset, offset + length);
    offset += length;
    blocks.push({ data: part, ec: qrReedSolomon(part, ecCount) });
  }
  const out: number[] = [];
  const longest = Math.max(d1, d2);
  for (let i = 0; i < longest; i++) {
    for (const block of blocks) if (i < block.data.length) out.push(block.data[i]);
  }
  for (let i = 0; i < ecCount; i++) {
    for (const block of blocks) out.push(block.ec[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Matrix
// ---------------------------------------------------------------------------

class Matrix {
  readonly size: number;
  readonly dark: boolean[][];
  readonly isFunction: boolean[][];

  constructor(readonly version: number) {
    this.size = 17 + 4 * version;
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  setFunction(row: number, col: number, dark: boolean): void {
    this.dark[row][col] = dark;
    this.isFunction[row][col] = true;
  }

  drawFunctionPatterns(): void {
    const { size, version } = this;
    // Timing patterns (row 6 and column 6).
    for (let i = 0; i < size; i++) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }
    // Finder patterns with their separators.
    this.drawFinder(3, 3);
    this.drawFinder(3, size - 4);
    this.drawFinder(size - 4, 3);
    // Alignment patterns (not over the finders).
    const centres = ALIGNMENT_CENTRES[version];
    const last = centres.length - 1;
    for (let i = 0; i < centres.length; i++) {
      for (let j = 0; j < centres.length; j++) {
        const overFinder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
        if (!overFinder) this.drawAlignment(centres[i], centres[j]);
      }
    }
    // Reserve the format areas (written for real once the mask is known) and the version blocks.
    this.drawFormat(0);
    this.drawVersion();
  }

  private drawFinder(centreRow: number, centreCol: number): void {
    for (let dr = -4; dr <= 4; dr++) {
      for (let dc = -4; dc <= 4; dc++) {
        const r = centreRow + dr;
        const c = centreCol + dc;
        if (r < 0 || c < 0 || r >= this.size || c >= this.size) continue;
        const ring = Math.max(Math.abs(dr), Math.abs(dc));
        // Rings 0-1 dark centre, 2 light, 3 dark border, 4 light separator.
        this.setFunction(r, c, ring !== 2 && ring !== 4);
      }
    }
  }

  private drawAlignment(centreRow: number, centreCol: number): void {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        this.setFunction(centreRow + dr, centreCol + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
      }
    }
  }

  /** Writes the 15 format bits (both copies) and the dark module. */
  drawFormat(bits: number): void {
    const { size } = this;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    // Copy 1, around the top-left finder.
    for (let i = 0; i <= 5; i++) this.setFunction(i, 8, bit(i));
    this.setFunction(7, 8, bit(6));
    this.setFunction(8, 8, bit(7));
    this.setFunction(8, 7, bit(8));
    for (let i = 9; i < 15; i++) this.setFunction(8, 14 - i, bit(i));
    // Copy 2, split between the top-right and bottom-left finders.
    for (let i = 0; i < 8; i++) this.setFunction(8, size - 1 - i, bit(i));
    for (let i = 8; i < 15; i++) this.setFunction(size - 15 + i, 8, bit(i));
    // The dark module next to the bottom-left finder.
    this.setFunction(size - 8, 8, true);
  }

  /** Version information (18 bits, two copies) for versions 7 and above. */
  private drawVersion(): void {
    if (this.version < 7) return;
    const bits = qrVersionBits(this.version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(b, a, dark); // top-right block
      this.setFunction(a, b, dark); // bottom-left block
    }
  }

  /** Places the codewords in the zigzag order, skipping function modules. */
  drawCodewords(codewords: readonly number[]): void {
    const { size } = this;
    let bitIndex = 0;
    const totalBits = codewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // skip the vertical timing column
      const upward = ((right + 1) & 2) === 0;
      for (let v = 0; v < size; v++) {
        const row = upward ? size - 1 - v : v;
        for (let j = 0; j < 2; j++) {
          const col = right - j;
          if (this.isFunction[row][col]) continue;
          if (bitIndex < totalBits) {
            this.dark[row][col] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
            bitIndex++;
          }
          // Remainder bits stay light (false).
        }
      }
    }
  }

  /** XORs the mask pattern over the non-function modules (applying it twice undoes it). */
  applyMask(mask: number): void {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (!this.isFunction[row][col] && qrMaskCondition(mask, row, col)) this.dark[row][col] = !this.dark[row][col];
      }
    }
  }

  penalty(): number {
    return qrPenalty(this.dark);
  }
}

/** True when the mask pattern inverts the module at (row, col) (standard table 10). */
export function qrMaskCondition(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      throw new RangeError('QR: mask must be 0-7');
  }
}

/** 15-bit format information (5 data bits + BCH(15,5) remainder, XOR 0x5412). */
export function qrFormatBits(ecLevel: QrEcLevel, mask: number): number {
  const data = (EC_FORMAT_BITS[ecLevel] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | (rem & 0x3ff)) ^ FORMAT_MASK;
}

/** 18-bit version information (6 data bits + BCH(18,6) remainder), versions >= 7. */
export function qrVersionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | (rem & 0xfff);
}

/** Penalty score of a finished symbol (rules N1 = 3, N2 = 3, N3 = 40, N4 = 10). */
export function qrPenalty(dark: readonly (readonly boolean[])[]): number {
  const size = dark.length;
  let score = 0;
  const at = (r: number, c: number, transpose: boolean) => (transpose ? dark[c][r] : dark[r][c]);

  for (const transpose of [false, true]) {
    for (let r = 0; r < size; r++) {
      // Rule 1: five or more same-coloured modules in a row (or column).
      let run = 1;
      for (let c = 1; c <= size; c++) {
        if (c < size && at(r, c, transpose) === at(r, c - 1, transpose)) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      // Rule 3: 1:1:3:1:1 finder-like pattern with four light modules on one side.
      for (let c = 0; c + 11 <= size; c++) {
        let a = true;
        let b = true;
        for (let k = 0; k < 11; k++) {
          const v = at(r, c + k, transpose);
          if (v !== FINDER_LIKE_A[k]) a = false;
          if (v !== FINDER_LIKE_B[k]) b = false;
          if (!a && !b) break;
        }
        if (a) score += 40;
        if (b) score += 40;
      }
    }
  }

  // Rule 2: 2x2 blocks of one colour.
  for (let r = 0; r + 1 < size; r++) {
    for (let c = 0; c + 1 < size; c++) {
      const v = dark[r][c];
      if (v === dark[r][c + 1] && v === dark[r + 1][c] && v === dark[r + 1][c + 1]) score += 3;
    }
  }

  // Rule 4: balance of dark modules, 10 points per 5 % away from 50 %.
  let darkCount = 0;
  for (const row of dark) for (const v of row) if (v) darkCount++;
  const total = size * size;
  const k = Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1;
  score += Math.max(0, k) * 10;
  return score;
}

const FINDER_LIKE_A = [true, false, true, true, true, false, true, false, false, false, false];
const FINDER_LIKE_B = [false, false, false, false, true, false, true, true, true, false, true];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Smallest version in [min, max] whose byte-mode capacity holds `length` bytes, or -1. */
export function qrVersionFor(length: number, ecLevel: QrEcLevel = 'M', min = QR_MIN_VERSION, max = QR_MAX_VERSION): number {
  for (let v = Math.max(QR_MIN_VERSION, min); v <= Math.min(QR_MAX_VERSION, max); v++) {
    if (qrByteCapacity(v, ecLevel) >= length) return v;
  }
  return -1;
}

/**
 * Encodes `text` (UTF-8, byte mode) into a QR symbol. Throws a RangeError when
 * the text does not fit into the allowed versions.
 */
export function encodeQr(text: string, options: QrOptions = {}): QrCode {
  const ecLevel = options.ecLevel ?? 'M';
  const bytes = new TextEncoder().encode(text);
  const version = qrVersionFor(bytes.length, ecLevel, options.minVersion ?? QR_MIN_VERSION, options.maxVersion ?? QR_MAX_VERSION);
  if (version < 0) throw new RangeError(`QR: ${bytes.length} bytes do not fit into version ${options.maxVersion ?? QR_MAX_VERSION} (level ${ecLevel})`);
  if (options.mask !== undefined && !(Number.isInteger(options.mask) && options.mask >= 0 && options.mask <= 7)) {
    throw new RangeError('QR: mask must be 0-7');
  }

  const codewords = interleave(qrDataBytes(bytes, version, ecLevel), version, ecLevel);
  const matrix = new Matrix(version);
  matrix.drawFunctionPatterns();
  matrix.drawCodewords(codewords);

  let mask = options.mask ?? -1;
  if (mask < 0) {
    let best = Infinity;
    for (let m = 0; m < 8; m++) {
      matrix.applyMask(m);
      matrix.drawFormat(qrFormatBits(ecLevel, m));
      const score = matrix.penalty();
      if (score < best) {
        best = score;
        mask = m;
      }
      matrix.applyMask(m); // undo
    }
  }
  matrix.applyMask(mask);
  matrix.drawFormat(qrFormatBits(ecLevel, mask));

  return { version, size: matrix.size, ecLevel, mask, modules: matrix.dark.map((row) => row.slice()) };
}

/** Side of the SVG view box: the symbol plus the quiet zone on both sides. */
export function qrViewSize(qr: QrCode, margin = 4): number {
  return qr.size + margin * 2;
}

/**
 * SVG path data drawing every dark module as a 1x1 square (horizontal runs are
 * merged), offset by the quiet zone `margin` (default 4 modules, as the standard asks).
 */
export function qrSvgPath(qr: QrCode, margin = 4): string {
  const parts: string[] = [];
  for (let row = 0; row < qr.size; row++) {
    let col = 0;
    while (col < qr.size) {
      if (!qr.modules[row][col]) {
        col++;
        continue;
      }
      const start = col;
      while (col < qr.size && qr.modules[row][col]) col++;
      parts.push(`M${start + margin} ${row + margin}h${col - start}v1h-${col - start}z`);
    }
  }
  return parts.join('');
}
