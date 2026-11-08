/**
 * Google Play kit (WP-17, docs/play-tasks/PLAY-LISTING.md): the two listing graphics in play/graphics/
 * and their renderer scripts/play/render-graphics.mjs (plain Node, no dependencies).
 *
 * Play Console Help "Add preview assets" (support.google.com/googleplay/android-developer/answer/9866151):
 *   - App icon: "32-bit PNG (with alpha)", "512px by 512px", at most 1024 KB;
 *   - Feature graphic: "JPEG or 24-bit PNG (no alpha)", "1024px by 500px".
 * The icon design specification (developer.android.com/distribute/google-play/resources/icon-design-specifications)
 * asks for a full square that Play masks itself, so the icon is fully opaque inside its alpha channel.
 *
 * Checked here: sizes, bit depth, colour type (alpha channel present / absent), file size, that the
 * committed files are what the renderer produces from the current app icon (pixel for pixel), that
 * rendering is deterministic (byte for byte, no time stamps or text chunks), and that the artwork is the
 * app icon itself.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BRAND_GRADIENT,
  DEFAULT_OUT_DIR,
  FEATURE,
  ICON,
  SOURCE_ICON,
  decodePng,
  encodePng,
  gradientAt,
  pngInfo,
  render,
  renderFeature,
  renderIcon,
} from '../../scripts/play/render-graphics.mjs';

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'play', 'render-graphics.mjs');
const COMMITTED_ICON = path.join(DEFAULT_OUT_DIR, ICON.file);
const COMMITTED_FEATURE = path.join(DEFAULT_OUT_DIR, FEATURE.file);

/** PNG colour types (PNG spec 11.2.2): 2 = truecolour (RGB, 24-bit at depth 8), 6 = truecolour with alpha (RGBA, 32-bit). */
const RGB = 2;
const RGBA = 6;

const tempDirs: string[] = [];
afterAll(() => {
  for (const d of tempDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-play-graphics-'));
  tempDirs.push(dir);
  return dir;
}

/** The chunk types of a PNG file, in order. */
function chunkTypes(buf: Buffer): string[] {
  const types: string[] = [];
  for (let p = 8; p < buf.length; ) {
    const len = buf.readUInt32BE(p);
    types.push(buf.toString('latin1', p + 4, p + 8));
    p += 12 + len;
  }
  return types;
}

describe('play/graphics/icon-512.png (the hi-res icon)', () => {
  const buf = fs.readFileSync(COMMITTED_ICON);
  const info = pngInfo(buf);

  it('is a 512 x 512 32-bit PNG with an alpha channel, under 1024 KB', () => {
    expect([info.width, info.height]).toEqual([512, 512]);
    expect(info.bitDepth).toBe(8);
    expect(info.colorType).toBe(RGBA);
    expect(info.interlace).toBe(0);
    expect(buf.length).toBeLessThanOrEqual(1024 * 1024);
  });

  it('is a full square: every pixel opaque (Play masks the corners itself), so no see-through corners', () => {
    const { data } = decodePng(buf);
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) transparent += 1;
    expect(transparent).toBe(0);
  });

  it('is the app icon over the brand gradient: identical wherever the app icon is opaque', () => {
    const source = decodePng(fs.readFileSync(SOURCE_ICON));
    const icon = decodePng(buf);
    let differ = 0;
    let opaque = 0;
    for (let i = 0; i < source.data.length; i += 4) {
      if (source.data[i + 3] !== 255) continue;
      opaque += 1;
      if (source.data[i] !== icon.data[i] || source.data[i + 1] !== icon.data[i + 1] || source.data[i + 2] !== icon.data[i + 2]) differ += 1;
    }
    expect(opaque).toBeGreaterThan(512 * 512 * 0.8);
    expect(differ).toBe(0);
    // The corners, transparent in the app icon, carry the brand gradient's end colours.
    expect([...icon.data.slice(0, 3)]).toEqual(gradientAt(0.5 / 512));
    const last = icon.data.length - 4;
    expect([...icon.data.slice(last, last + 3)]).toEqual(gradientAt((511.5 / 512 + 511.5 / 512) / 2));
  });
});

describe('play/graphics/feature-1024x500.png (the feature graphic)', () => {
  const buf = fs.readFileSync(COMMITTED_FEATURE);
  const info = pngInfo(buf);

  it('is a 1024 x 500 24-bit PNG without an alpha channel', () => {
    expect([info.width, info.height]).toEqual([1024, 500]);
    expect(info.bitDepth).toBe(8);
    expect(info.colorType).toBe(RGB);
    expect(info.interlace).toBe(0);
  });

  it('carries no transparency chunk either (tRNS would add alpha to an RGB PNG)', () => {
    expect(chunkTypes(buf)).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('is one file for every language: no per-locale variants next to it', () => {
    const variants = fs.readdirSync(DEFAULT_OUT_DIR).filter((n) => n.startsWith('feature-') && n !== FEATURE.file);
    expect(variants).toEqual([]);
  });

  it('shows the artwork in the middle and the brand gradient at the edges', () => {
    const { data, width, height } = decodePng(buf);
    const at = (x: number, y: number) => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 3)];
    // Edges: the gradient (the soft light does not reach the corners).
    expect(at(0, 0)).toEqual(gradientAt((0.5 / width + 0.5 / height) / 2));
    expect(at(width - 1, height - 1)).toEqual(gradientAt(((width - 0.5) / width + (height - 0.5) / height) / 2));
    // Middle: something brighter than any gradient colour (the light page of the book).
    const maxGradient = Math.max(...BRAND_GRADIENT.from, ...BRAND_GRADIENT.to);
    let bright = 0;
    for (let y = height / 2 - 100; y < height / 2 + 100; y += 1) {
      for (let x = width / 2 - 100; x < width / 2 + 100; x += 1) if (Math.min(...at(x, y)) > maxGradient + 100) bright += 1;
    }
    expect(bright).toBeGreaterThan(5000);
  });
});

describe('scripts/play/render-graphics.mjs', () => {
  it('writes the two files with the command line and reports their formats', () => {
    const out = tempDir();
    const r = spawnSync(process.execPath, [SCRIPT, '--out', out], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('icon-512.png: 512x512, 32-bit RGBA');
    expect(r.stdout).toContain('feature-1024x500.png: 1024x500, 24-bit RGB');
    expect(fs.readdirSync(out).sort()).toEqual([FEATURE.file, ICON.file].sort());
  });

  it('is deterministic: two renders give the same bytes, with no time stamp or text chunk', () => {
    const a = render(tempDir());
    const b = render(tempDir());
    for (const [x, y] of [
      [a.iconPath, b.iconPath],
      [a.featurePath, b.featurePath],
    ]) {
      const bx = fs.readFileSync(x);
      expect(bx.equals(fs.readFileSync(y))).toBe(true);
      expect(chunkTypes(bx)).toEqual(['IHDR', 'IDAT', 'IEND']);
    }
  });

  it('produced the committed files from the current app icon (re-run it after the icon changes)', () => {
    const out = render(tempDir());
    // Pixels, not bytes: another zlib build may compress the same pixels differently.
    expect(Buffer.from(decodePng(fs.readFileSync(out.iconPath)).data).equals(Buffer.from(decodePng(fs.readFileSync(COMMITTED_ICON)).data))).toBe(true);
    expect(Buffer.from(decodePng(fs.readFileSync(out.featurePath)).data).equals(Buffer.from(decodePng(fs.readFileSync(COMMITTED_FEATURE)).data))).toBe(true);
  });

  it('round-trips its own PNG codec (RGBA and RGB) and refuses a file that is not a PNG', () => {
    const img = { width: 3, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255]) };
    expect([...decodePng(encodePng(img, { alpha: true })).data]).toEqual([...img.data]);
    const rgb = decodePng(encodePng(img, { alpha: false }));
    expect(pngInfo(encodePng(img, { alpha: false })).colorType).toBe(RGB);
    for (let i = 0; i < 6; i += 1) {
      expect([...rgb.data.slice(i * 4, i * 4 + 3)]).toEqual([...img.data.slice(i * 4, i * 4 + 3)]);
      expect(rgb.data[i * 4 + 3]).toBe(255);
    }
    expect(() => pngInfo(Buffer.from('not a png at all, just some text'))).toThrow('not a PNG file');
  });

  it('refuses a source icon of the wrong size', () => {
    expect(() => renderIcon({ width: 256, height: 256, data: new Uint8Array(256 * 256 * 4) })).toThrow('expected 512x512');
    // The feature graphic scales the artwork, so any square source works there.
    const feature = renderFeature(decodePng(fs.readFileSync(SOURCE_ICON)));
    expect([feature.width, feature.height]).toEqual([1024, 500]);
  });
});
