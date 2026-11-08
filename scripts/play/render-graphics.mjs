#!/usr/bin/env node
/**
 * scripts/play/render-graphics.mjs - renders the two Google Play graphics from the app icon, with
 * plain Node (no dependencies, nothing downloaded), deterministically: the same sources give the
 * same pixels on every run.
 *
 *   node scripts/play/render-graphics.mjs              write play/graphics/icon-512.png and feature-1024x500.png
 *   node scripts/play/render-graphics.mjs --out <dir>  write them somewhere else (the tests)
 *
 * Source: src-tauri/icons/icon.png - the app icon, 512x512 RGBA, rendered from design/app-icon.svg
 * (a book with a lock on a rounded square filled with the brand gradient #2b4c7e -> #1b2f4f along the
 * diagonal; the corners outside the rounding are transparent).
 *
 * play/graphics/icon-512.png - the hi-res icon. Play's icon specification (developer.android.com/
 * distribute/google-play/resources/icon-design-specifications, fetched 2026-10-26): "Final size:
 * 512px x 512px", "Format: 32-bit PNG", "Shape: Full square - Google Play dynamically handles
 * masking. Radius will be equivalent to 30% of icon size", "Don't round the edges of your final
 * asset", "Fill your entire asset with artwork when possible", "Transparent assets will display the
 * background color of Google Play UI", no shadow ("Google Play dynamically handles shadows"). So the
 * icon is drawn over the same brand gradient extended to the full square: the rounded corners
 * disappear into it seamlessly (the icon's own background IS that gradient, pixel for pixel), and the
 * result is a fully opaque 32-bit RGBA PNG. Play Console limit: 1024 KB.
 *
 * play/graphics/feature-1024x500.png - the feature graphic. Play Console Help "Add preview assets"
 * (support.google.com/googleplay/android-developer/answer/9866151): "JPEG or 24-bit PNG (no alpha)",
 * "1024px by 500px". It carries no text, so one file serves all 20 languages ("Localize your graphic
 * and branding text as appropriate" applies only to graphics with text): the brand gradient across
 * the banner, a soft light behind the centre, and the book-and-lock artwork of the icon (its
 * background removed, since the banner continues the same gradient) scaled to 340 px and centred,
 * where Play keeps the feature graphic visible on every surface.
 *
 * The PNG codec below handles what the icon uses: 8-bit RGB / RGBA, non-interlaced, any filter.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const SOURCE_ICON = path.join(ROOT, 'src-tauri', 'icons', 'icon.png');
export const DEFAULT_OUT_DIR = path.join(ROOT, 'play', 'graphics');

export const ICON = { file: 'icon-512.png', width: 512, height: 512, maxBytes: 1024 * 1024 };
export const FEATURE = { file: 'feature-1024x500.png', width: 1024, height: 500 };

/** The brand gradient of design/app-icon.svg: from the top-left to the bottom-right corner. */
export const BRAND_GRADIENT = { from: [0x2b, 0x4c, 0x7e], to: [0x1b, 0x2f, 0x4f] };
/** The page colour of the icon, used for the soft light behind the artwork. */
const PAGE_LIGHT = [0xff, 0xfd, 0xf6];
/** Height of the artwork on the feature graphic. */
const FEATURE_ART_HEIGHT = 340;

// ---------------------------------------------------------------------------------------------
// PNG codec
// ---------------------------------------------------------------------------------------------
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Width, height, bit depth and colour type of a PNG (IHDR only). Throws when the buffer is not a PNG. */
export function pngInfo(buf) {
  if (buf.length < 29 || !buf.subarray(0, 8).equals(PNG_SIGNATURE) || buf.toString('latin1', 12, 16) !== 'IHDR') {
    throw new Error('not a PNG file');
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bitDepth: buf[24], colorType: buf[25], interlace: buf[28] };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Decodes an 8-bit RGB or RGBA, non-interlaced PNG into straight (non-premultiplied) RGBA pixels.
 * Returns { width, height, data } with data = Uint8Array of width * height * 4 bytes.
 */
export function decodePng(buf) {
  const info = pngInfo(buf);
  if (info.bitDepth !== 8 || (info.colorType !== 2 && info.colorType !== 6) || info.interlace !== 0) {
    throw new Error(`unsupported PNG (bit depth ${info.bitDepth}, colour type ${info.colorType}, interlace ${info.interlace}): only 8-bit RGB / RGBA, non-interlaced`);
  }
  const idat = [];
  for (let p = 8; p < buf.length; ) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { width, height } = info;
  const bpp = info.colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const rows = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = y * stride;
    const prev = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? rows[row + x - bpp] : 0;
      const b = y > 0 ? rows[prev + x] : 0;
      const c = x >= bpp && y > 0 ? rows[prev + x - bpp] : 0;
      let v = src[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
      rows[row + x] = v & 0xff;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = rows[i * bpp];
    data[i * 4 + 1] = rows[i * bpp + 1];
    data[i * 4 + 2] = rows[i * bpp + 2];
    data[i * 4 + 3] = bpp === 4 ? rows[i * 4 + 3] : 255;
  }
  return { width, height, data };
}

/**
 * Encodes RGBA pixels as a PNG: colour type 6 (32-bit RGBA) when `alpha` is true, colour type 2
 * (24-bit RGB, the alpha channel dropped) otherwise. Every row uses the "Up" filter - small residuals
 * on gradients, and one fixed choice keeps the output deterministic. Only IHDR, IDAT and IEND are
 * written (no time stamp, no text chunks).
 */
export function encodePng({ width, height, data }, { alpha }) {
  const bpp = alpha ? 4 : 3;
  const stride = width * bpp;
  const filtered = Buffer.alloc(height * (stride + 1));
  const line = Buffer.alloc(stride);
  const prevLine = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const s = (y * width + x) * 4;
      line[x * bpp] = data[s];
      line[x * bpp + 1] = data[s + 1];
      line[x * bpp + 2] = data[s + 2];
      if (alpha) line[x * 4 + 3] = data[s + 3];
    }
    const o = y * (stride + 1);
    filtered[o] = 2;
    for (let x = 0; x < stride; x += 1) filtered[o + 1 + x] = (line[x] - prevLine[x]) & 0xff;
    line.copy(prevLine);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(filtered, { level: 9 });
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------------------------
// Drawing helpers (all in straight RGBA, 0-255)
// ---------------------------------------------------------------------------------------------
/** The brand gradient colour at a point: t = 0 at the top-left corner, 1 at the bottom-right one. */
export function gradientAt(t) {
  const { from, to } = BRAND_GRADIENT;
  return from.map((v, i) => Math.round(v + (to[i] - v) * t));
}

function blank(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

/** Fills an image with the brand gradient (as design/app-icon.svg draws it: along the diagonal). */
function fillGradient(img) {
  const { width, height, data } = img;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = ((x + 0.5) / width + (y + 0.5) / height) / 2;
      const [r, g, b] = gradientAt(t);
      const o = (y * width + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
}

/** "Over" compositing of `src` onto `dst` at (left, top); both straight alpha. */
function composite(dst, src, left, top) {
  for (let y = 0; y < src.height; y += 1) {
    const dy = top + y;
    if (dy < 0 || dy >= dst.height) continue;
    for (let x = 0; x < src.width; x += 1) {
      const dx = left + x;
      if (dx < 0 || dx >= dst.width) continue;
      const s = (y * src.width + x) * 4;
      const a = src.data[s + 3] / 255;
      if (a === 0) continue;
      const d = (dy * dst.width + dx) * 4;
      const da = dst.data[d + 3] / 255;
      const outA = a + da * (1 - a);
      for (let c = 0; c < 3; c += 1) {
        const v = (src.data[s + c] * a + dst.data[d + c] * da * (1 - a)) / (outA || 1);
        dst.data[d + c] = Math.round(v);
      }
      dst.data[d + 3] = Math.round(outA * 255);
    }
  }
}

/** A soft round light: `strength` (0-1) at the centre, fading to nothing at `radius`. */
function glow(img, cx, cy, radius, color, strength) {
  const { width, height, data } = img;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d >= radius) continue;
      const f = 1 - d / radius;
      const a = strength * f * f;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) data[o + c] = Math.round(data[o + c] * (1 - a) + color[c] * a);
    }
  }
}

/**
 * The icon without its background: every pixel whose colour is the brand gradient at its own
 * position (within a tolerance of 2 per channel) becomes transparent; the rest (book, lines, lock)
 * keeps its colour. Edge pixels blend background and artwork; placed over the same gradient again
 * they look exactly as in the icon.
 */
export function artworkOf(icon) {
  const out = { width: icon.width, height: icon.height, data: new Uint8Array(icon.data) };
  for (let y = 0; y < icon.height; y += 1) {
    for (let x = 0; x < icon.width; x += 1) {
      const o = (y * icon.width + x) * 4;
      if (out.data[o + 3] === 0) continue;
      const t = ((x + 0.5) / icon.width + (y + 0.5) / icon.height) / 2;
      const [r, g, b] = gradientAt(t);
      if (Math.abs(out.data[o] - r) <= 2 && Math.abs(out.data[o + 1] - g) <= 2 && Math.abs(out.data[o + 2] - b) <= 2) out.data[o + 3] = 0;
    }
  }
  return out;
}

/** Area-averaging downscale of a straight-alpha RGBA image (premultiplied inside). */
export function resample(src, dw, dh) {
  const out = blank(dw, dh);
  const sx = src.width / dw;
  const sy = src.height / dh;
  for (let dy = 0; dy < dh; dy += 1) {
    const y0 = dy * sy;
    const y1 = (dy + 1) * sy;
    for (let dx = 0; dx < dw; dx += 1) {
      const x0 = dx * sx;
      const x1 = (dx + 1) * sx;
      let wSum = 0;
      let aSum = 0;
      const cSum = [0, 0, 0];
      for (let y = Math.floor(y0); y < Math.ceil(y1); y += 1) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for (let x = Math.floor(x0); x < Math.ceil(x1); x += 1) {
          const w = wy * (Math.min(x + 1, x1) - Math.max(x, x0));
          const s = (y * src.width + x) * 4;
          const a = src.data[s + 3] / 255;
          wSum += w;
          aSum += w * a;
          for (let c = 0; c < 3; c += 1) cSum[c] += w * a * src.data[s + c];
        }
      }
      const o = (dy * dw + dx) * 4;
      if (aSum > 0) for (let c = 0; c < 3; c += 1) out.data[o + c] = Math.round(cSum[c] / aSum);
      out.data[o + 3] = Math.round((aSum / wSum) * 255);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The two graphics
// ---------------------------------------------------------------------------------------------
/** The hi-res icon: the app icon over the brand gradient filling the whole square (fully opaque). */
export function renderIcon(icon) {
  if (icon.width !== ICON.width || icon.height !== ICON.height) throw new Error(`the source icon is ${icon.width}x${icon.height}, expected ${ICON.width}x${ICON.height}`);
  const out = blank(ICON.width, ICON.height);
  fillGradient(out);
  composite(out, icon, 0, 0);
  return out;
}

/** The feature graphic: gradient banner, soft light, the book-and-lock artwork centred (no text). */
export function renderFeature(icon) {
  const out = blank(FEATURE.width, FEATURE.height);
  fillGradient(out);
  const cx = FEATURE.width / 2;
  const cy = FEATURE.height / 2;
  glow(out, cx, cy, 310, PAGE_LIGHT, 0.16);
  const art = resample(artworkOf(icon), FEATURE_ART_HEIGHT, FEATURE_ART_HEIGHT);
  composite(out, art, Math.round(cx - art.width / 2), Math.round(cy - art.height / 2));
  return out;
}

/** Renders both files into `outDir` (created when missing); returns their paths. */
export function render(outDir = DEFAULT_OUT_DIR, sourceIcon = SOURCE_ICON) {
  if (!existsSync(sourceIcon)) throw new Error(`source icon not found: ${sourceIcon}`);
  const icon = decodePng(readFileSync(sourceIcon));
  mkdirSync(outDir, { recursive: true });
  const iconPath = path.join(outDir, ICON.file);
  const featurePath = path.join(outDir, FEATURE.file);
  const iconPng = encodePng(renderIcon(icon), { alpha: true });
  if (iconPng.length > ICON.maxBytes) throw new Error(`${ICON.file} is ${iconPng.length} bytes, Play allows ${ICON.maxBytes}`);
  writeFileSync(iconPath, iconPng);
  writeFileSync(featurePath, encodePng(renderFeature(icon), { alpha: false }));
  return { iconPath, featurePath };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--out');
  const outDir = i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : DEFAULT_OUT_DIR;
  const { iconPath, featurePath } = render(outDir);
  for (const file of [iconPath, featurePath]) {
    const buf = readFileSync(file);
    const info = pngInfo(buf);
    console.log(`wrote ${path.relative(process.cwd(), file)}: ${info.width}x${info.height}, ${info.colorType === 6 ? '32-bit RGBA' : '24-bit RGB'}, ${buf.length} bytes`);
  }
}
