#!/usr/bin/env node
/**
 * appstore/icon/render-icon.mjs - makes the App Store icon appstore/icon/AppIcon-1024.png from the app's own
 * artwork design/app-icon.svg (docs/apple-tasks/SHOTS.md "ICON"; Apple's rules in docs/apple-tasks/APPSTORE-FACTS.md
 * section 7: a square 1024x1024 image, the system masks the rounded corners itself, PNG, sRGB, nothing transparent).
 *
 *   node appstore/icon/render-icon.mjs            writes AppIcon-1024.png and AppIcon-1024.svg next to this file
 *   node appstore/icon/render-icon.mjs --check    only checks the existing AppIcon-1024.png (exit 1 when it is wrong)
 *
 * How: the SVG's background is a 1024x1024 rectangle filled with the brand gradient, drawn with rounded corners
 * (rx="220") - outside those corners the SVG is transparent. Apple wants the full square (it applies its own
 * mask, and a pre-rounded icon gets jagged edges and no highlight), so the copy rendered here has rx="0": the same
 * artwork, flattened on its own gradient background to the edges (flattenSvg). Headless Microsoft Edge
 * (playwright-core from the screenshot tool folder, exactly as scripts/play/render-screenshots.mjs uses it, with
 * every request blocked) renders that SVG at exactly 1024x1024 CSS px at device scale 1; the capture is checked to
 * be fully opaque and written as a 24-bit RGB PNG (colour type 2, no alpha channel) with an sRGB chunk. The
 * flattened SVG is kept as AppIcon-1024.svg for a future developer (Icon Composer, another renderer).
 *
 * Why not src-tauri/icons/icon.png: it is 512x512 with an alpha channel (and so are Tauri's generated iOS icons,
 * src-tauri/icons/ios/AppIcon-512@2x.png included: 1024x1024, colour type 6). Upscaling 512 to 1024 blurs the
 * artwork; the SVG is the source of all of them.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from '../../scripts/play/render-graphics.mjs';
import { freePort, loadPlaywright } from '../../scripts/play/render-screenshots.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const SVG_SOURCE = path.join(ROOT, 'design', 'app-icon.svg');
export const OUT_PNG = path.join(HERE, 'AppIcon-1024.png');
export const OUT_SVG = path.join(HERE, 'AppIcon-1024.svg');
export const SIZE = 1024;

const BACKGROUND_RECT = /<rect x="0" y="0" width="1024" height="1024" rx="(\d+)" fill="url\(#bg\)"\/>/;

/** The SVG with its background rectangle's corners squared (rx="0"): the artwork flattened on its own gradient. */
export function flattenSvg(svg) {
  if (!BACKGROUND_RECT.test(svg)) throw new Error('design/app-icon.svg: the 1024x1024 background rect filled with url(#bg) was not found - the artwork changed; adapt flattenSvg in appstore/icon/render-icon.mjs');
  return svg.replace(BACKGROUND_RECT, '<rect x="0" y="0" width="1024" height="1024" rx="0" fill="url(#bg)"/>');
}

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

/**
 * The PNG with an sRGB chunk (rendering intent 0, perceptual) and the matching gAMA chunk (1/2.2) inserted after
 * IHDR, so the colour space Apple asks for (sRGB) is declared in the file, not only assumed.
 */
export function withSrgbChunks(png) {
  const ihdrEnd = 8 + 12 + 13;
  if (png.toString('latin1', 12, 16) !== 'IHDR') throw new Error('not a PNG with IHDR first');
  const gama = Buffer.alloc(4);
  gama.writeUInt32BE(45455, 0);
  return Buffer.concat([png.subarray(0, ihdrEnd), chunk('sRGB', Buffer.from([0])), chunk('gAMA', gama), png.subarray(ihdrEnd)]);
}

/** Width, height, bit depth, colour type and the chunk types of a PNG (the check line of the README, as a function). */
export function pngHeader(buf) {
  if (buf.toString('latin1', 12, 16) !== 'IHDR') throw new Error('not a PNG file');
  const chunks = [];
  for (let p = 8; p + 12 <= buf.length; ) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    chunks.push(type);
    if (type === 'IEND') break;
    p += 12 + len;
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bitDepth: buf[24], colorType: buf[25], chunks };
}

/** The problems of an icon file (empty when it is what Apple takes). */
export function iconFileProblems(buf) {
  const problems = [];
  let header;
  try {
    header = pngHeader(buf);
  } catch (e) {
    return [e.message];
  }
  if (header.width !== SIZE || header.height !== SIZE) problems.push(`${header.width}x${header.height}, expected ${SIZE}x${SIZE}`);
  if (header.colorType !== 2 || header.bitDepth !== 8) problems.push(`colour type ${header.colorType}, ${header.bitDepth} bit - expected 24-bit RGB (colour type 2) without alpha`);
  if (header.chunks.includes('tRNS')) problems.push('has a tRNS (transparency) chunk');
  if (!header.chunks.includes('sRGB')) problems.push('no sRGB chunk');
  return problems;
}

export async function renderIcon({ svgSource = SVG_SOURCE, outPng = OUT_PNG, outSvg = OUT_SVG } = {}) {
  const svg = flattenSvg(fs.readFileSync(svgSource, 'utf8'));
  const { chromium, version, dir } = loadPlaywright();
  const deadPort = await freePort();
  console.log(`Microsoft Edge (playwright-core ${version} from ${dir}), ${SIZE}x${SIZE} at device scale 1, every request blocked`);
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--host-resolver-rules=MAP * ~NOTFOUND', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings', '--disable-gpu', '--num-raster-threads=1'],
    proxy: { server: `http://127.0.0.1:${deadPort}` },
  });
  try {
    const context = await browser.newContext({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1, colorScheme: 'light' });
    await context.route('**/*', (route) => route.abort('blockedbyclient'));
    const page = await context.newPage();
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:${SIZE}px;height:${SIZE}px;overflow:hidden;background:#1b2f4f}svg{display:block;width:${SIZE}px;height:${SIZE}px}</style></head><body>${svg}</body></html>`,
      { waitUntil: 'load' },
    );
    await page.waitForTimeout(200);
    const raw = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: SIZE, height: SIZE }, animations: 'disabled', scale: 'device', omitBackground: false });
    const img = decodePng(raw);
    if (img.width !== SIZE || img.height !== SIZE) throw new Error(`the capture is ${img.width}x${img.height}, expected ${SIZE}x${SIZE}`);
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) throw new Error(`the capture has a transparent pixel at ${((i - 3) / 4) % SIZE},${Math.floor((i - 3) / 4 / SIZE)}`);
    // The corners must be the gradient, not the page background: a pixel at (2, 2) is the gradient's start colour.
    const corner = [img.data[(2 * SIZE + 2) * 4], img.data[(2 * SIZE + 2) * 4 + 1], img.data[(2 * SIZE + 2) * 4 + 2]];
    if (Math.abs(corner[0] - 0x2b) > 6 || Math.abs(corner[1] - 0x4c) > 6 || Math.abs(corner[2] - 0x7e) > 6) throw new Error(`the top-left corner is rgb(${corner.join(',')}), expected the gradient's #2b4c7e - the background was not squared`);
    const png = withSrgbChunks(encodePng(img, { alpha: false }));
    fs.writeFileSync(outPng, png);
    fs.writeFileSync(outSvg, svg);
    const problems = iconFileProblems(png);
    if (problems.length) throw new Error(`the written icon is wrong: ${problems.join('; ')}`);
    const header = pngHeader(png);
    console.log(`${path.relative(ROOT, outPng)}: ${header.width}x${header.height}, ${header.bitDepth}-bit, PNG colour type ${header.colorType} (RGB, no alpha), chunks ${header.chunks.join(' ')}, ${png.length} bytes`);
    console.log(`${path.relative(ROOT, outSvg)}: the flattened SVG (${svg.length} characters)`);
    return { png, header };
  } finally {
    await browser.close().catch(() => {});
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--check')) {
    let problems;
    try {
      problems = iconFileProblems(fs.readFileSync(OUT_PNG));
    } catch (e) {
      problems = [e.message];
    }
    const header = problems.length ? null : pngHeader(fs.readFileSync(OUT_PNG));
    console.log(problems.length ? `${path.relative(ROOT, OUT_PNG)}: ${problems.join('; ')}` : `${path.relative(ROOT, OUT_PNG)}: ${header.width}x${header.height}, PNG colour type ${header.colorType} (RGB, no alpha), ${header.bitDepth}-bit, chunks ${header.chunks.join(' ')} - ok`);
    process.exit(problems.length ? 1 : 0);
  }
  renderIcon()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
