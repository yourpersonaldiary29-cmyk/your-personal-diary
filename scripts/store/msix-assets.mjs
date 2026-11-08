/**
 * Logo assets of the MSIX package, generated from the app icon with plain Node (no dependencies).
 *
 * Source: src-tauri/icons/icon.png (512x512 RGBA, the full-bleed rounded app icon).
 * Output: the qualified PNG files Windows expects under Assets\ (scale-*, targetsize-*,
 * altform-unplated / altform-lightunplated). resources.pri (makepri) maps the unqualified names
 * used in AppxManifest.xml (Assets\StoreLogo.png ...) to these files.
 *
 * A file placed in src-tauri/msix/assets/ with exactly the same name as a generated file
 * replaces the generated one (for hand-drawn assets); its pixel size must be the expected one.
 *
 * The PNG codec below handles what the app icon uses: 8-bit RGB / RGBA, non-interlaced.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** Scale qualifiers generated for every logo (100 and 200 are the required minimum). */
export const SCALES = [100, 125, 150, 200, 400];

/** Square44x44Logo target sizes (taskbar, Start list, title bar, Alt+Tab, search, jump lists). */
export const TARGET_SIZES = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256];

/** The subset of TARGET_SIZES that must always be present. */
export const REQUIRED_TARGET_SIZES = [16, 24, 32, 48, 256];

/**
 * Logos referenced by the manifest. `icon` is the part of the shorter canvas side covered by the
 * app icon: small logos are full-bleed (the icon has its own rounded background); tiles keep the
 * margin Windows expects around tile content (the tile background is transparent).
 */
export const LOGOS = [
  { name: 'StoreLogo', width: 50, height: 50, icon: 1 },
  { name: 'Square44x44Logo', width: 44, height: 44, icon: 1, targetSizes: true },
  { name: 'Square150x150Logo', width: 150, height: 150, icon: 0.64 },
  { name: 'Wide310x150Logo', width: 310, height: 150, icon: 0.64 },
  { name: 'Square310x310Logo', width: 310, height: 310, icon: 0.6 },
];

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

/** Width and height of a PNG file (IHDR only). Throws when the buffer is not a PNG. */
export function pngSize(buf) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE) || buf.toString('latin1', 12, 16) !== 'IHDR') {
    throw new Error('not a PNG file');
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Decodes an 8-bit RGB / RGBA non-interlaced PNG into { width, height, data: RGBA bytes }. */
export function decodePng(buf) {
  const { width, height } = pngSize(buf);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const interlace = buf[28];
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0) {
    throw new Error(`unsupported PNG (bit depth ${bitDepth}, colour type ${colorType}, interlace ${interlace}); need 8-bit RGB(A), non-interlaced`);
  }
  const idat = [];
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    if (type === 'IDAT') idat.push(buf.subarray(pos + 8, pos + 8 + len));
    if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  if (raw.length < (stride + 1) * height) throw new Error('truncated PNG data');
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? out[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let predictor;
      if (filter === 0) predictor = 0;
      else if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else throw new Error(`bad PNG filter ${filter}`);
      out[x] = (line[x] + predictor) & 0xff;
    }
  }
  if (bpp === 4) return { width, height, data: pixels };
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    rgba[j] = pixels[i];
    rgba[j + 1] = pixels[i + 1];
    rgba[j + 2] = pixels[i + 2];
    rgba[j + 3] = 255;
  }
  return { width, height, data: rgba };
}

/** Encodes RGBA bytes as an 8-bit RGBA PNG. */
export function encodePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); // filter byte stays 0 (None)
  }
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** One pass of area-average resampling along x (premultiplied float RGBA, `channels` = 4). */
function resampleX(src, sw, sh, tw) {
  const out = new Float64Array(tw * sh * 4);
  const scale = sw / tw;
  for (let x = 0; x < tw; x += 1) {
    const x0 = x * scale;
    const x1 = (x + 1) * scale;
    const first = Math.floor(x0);
    const last = Math.min(sw - 1, Math.ceil(x1) - 1);
    for (let sx = first; sx <= last; sx += 1) {
      const weight = (Math.min(sx + 1, x1) - Math.max(sx, x0)) / scale;
      if (weight <= 0) continue;
      for (let y = 0; y < sh; y += 1) {
        const si = (y * sw + sx) * 4;
        const di = (y * tw + x) * 4;
        out[di] += src[si] * weight;
        out[di + 1] += src[si + 1] * weight;
        out[di + 2] += src[si + 2] * weight;
        out[di + 3] += src[si + 3] * weight;
      }
    }
  }
  return out;
}

function transpose(src, w, h) {
  const out = new Float64Array(src.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const si = (y * w + x) * 4;
      const di = (x * h + y) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return out;
}

/**
 * Downscales an RGBA image to size x size with an area-average filter in premultiplied alpha
 * (no dark fringes on the rounded corners). Upscaling is refused: assets must stay sharp.
 */
export function resizeSquare(image, size) {
  if (image.width !== image.height) throw new Error('the source icon must be square');
  if (size > image.width) throw new Error(`refusing to upscale the ${image.width}px icon to ${size}px`);
  if (size === image.width) return { width: size, height: size, data: Buffer.from(image.data) };
  const n = image.width;
  const pre = new Float64Array(n * n * 4);
  for (let i = 0; i < n * n * 4; i += 4) {
    const a = image.data[i + 3] / 255;
    pre[i] = image.data[i] * a;
    pre[i + 1] = image.data[i + 1] * a;
    pre[i + 2] = image.data[i + 2] * a;
    pre[i + 3] = image.data[i + 3];
  }
  const pass1 = resampleX(pre, n, n, size); // size x n
  const pass2 = resampleX(transpose(pass1, size, n), n, size, size); // transposed: size x size
  const res = transpose(pass2, size, size);
  const data = Buffer.alloc(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = res[i + 3];
    if (alpha <= 0) continue;
    const a = alpha / 255;
    data[i] = Math.max(0, Math.min(255, Math.round(res[i] / a)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(res[i + 1] / a)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(res[i + 2] / a)));
    data[i + 3] = Math.max(0, Math.min(255, Math.round(alpha)));
  }
  return { width: size, height: size, data };
}

/** Transparent canvas with the icon centred. */
export function centerOnCanvas(icon, width, height) {
  const data = Buffer.alloc(width * height * 4);
  const left = Math.floor((width - icon.width) / 2);
  const top = Math.floor((height - icon.height) / 2);
  for (let y = 0; y < icon.height; y += 1) {
    icon.data.copy(data, ((top + y) * width + left) * 4, y * icon.width * 4, (y + 1) * icon.width * 4);
  }
  return { width, height, data };
}

/**
 * The list of asset files of the package: [{ file, width, height, iconSize, logo, qualifier }].
 * A scale is skipped when the icon would have to be enlarged beyond `sourceSize`
 * (only Square310x310Logo.scale-400 with the 512px icon); scale-100 and scale-200 always fit.
 */
export function assetPlan(sourceSize = 512) {
  const plan = [];
  for (const logo of LOGOS) {
    for (const scale of SCALES) {
      const width = Math.round((logo.width * scale) / 100);
      const height = Math.round((logo.height * scale) / 100);
      const iconSize = Math.round(Math.min(width, height) * logo.icon);
      if (iconSize > sourceSize) continue;
      plan.push({ file: `${logo.name}.scale-${scale}.png`, width, height, iconSize, logo: logo.name, qualifier: `scale-${scale}` });
    }
    if (logo.targetSizes) {
      for (const size of TARGET_SIZES) {
        for (const alt of ['', '_altform-unplated', '_altform-lightunplated']) {
          plan.push({
            file: `${logo.name}.targetsize-${size}${alt}.png`,
            width: size,
            height: size,
            iconSize: size,
            logo: logo.name,
            qualifier: `targetsize-${size}${alt}`,
          });
        }
      }
    }
  }
  return plan;
}

/**
 * Writes all assets into `outDir`. Returns [{ file, width, height, source: 'generated' | 'override' }].
 * @param {{ iconPath: string, outDir: string, overrideDir?: string }} options
 */
export function generateAssets({ iconPath, outDir, overrideDir }) {
  const icon = decodePng(fs.readFileSync(iconPath));
  if (icon.width !== icon.height) throw new Error(`${iconPath}: the icon must be square`);
  fs.mkdirSync(outDir, { recursive: true });
  const cache = new Map();
  const scaled = (size) => {
    if (!cache.has(size)) cache.set(size, resizeSquare(icon, size));
    return cache.get(size);
  };
  const written = [];
  for (const item of assetPlan(icon.width)) {
    const override = overrideDir ? path.join(overrideDir, item.file) : null;
    if (override && fs.existsSync(override)) {
      const bytes = fs.readFileSync(override);
      const size = pngSize(bytes);
      if (size.width !== item.width || size.height !== item.height) {
        throw new Error(`${override}: is ${size.width}x${size.height}, expected ${item.width}x${item.height}`);
      }
      fs.writeFileSync(path.join(outDir, item.file), bytes);
      written.push({ file: item.file, width: item.width, height: item.height, source: 'override' });
      continue;
    }
    const image = centerOnCanvas(scaled(item.iconSize), item.width, item.height);
    fs.writeFileSync(path.join(outDir, item.file), encodePng(image));
    written.push({ file: item.file, width: item.width, height: item.height, source: 'generated' });
  }
  return written;
}
