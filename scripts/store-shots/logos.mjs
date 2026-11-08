/**
 * Store logo images for the Partner Center "Store logos" section (optional for apps, prepared
 * anyway), rendered from the app icon (design/app-icon.svg) with the same headless Edge:
 *
 *   store/screenshots/logos/app-tile-icon-300x300.png   1:1 App tile icon (300 x 300) - the icon
 *                                                       alone, transparent corners
 *   store/screenshots/logos/box-art-1080x1080.png       1:1 box art (1080 x 1080)
 *   store/screenshots/logos/poster-art-720x1080.png     2:3 poster art (720 x 1080)
 *
 * The box art and the poster show the icon and the words "Your Personal Diary" (the brand is
 * always English) in the top two-thirds of the image, on a calm background made of the app's
 * light palette (src/styles/tokens.css: --color-bg #f4f6f9, --color-primary-soft #e2eaf6,
 * --color-primary #2b4c7e). Microsoft may overlay text on the bottom third, which stays empty.
 * Name colour #1b2f4f on #f4f6f9 has a contrast ratio of about 13:1 (requirement: 4.5:1).
 *
 *   node scripts/store-shots/logos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { LOGOS_DIR, REPO_ROOT, requireFromTools } from './config.mjs';

const { chromium } = requireFromTools('playwright-core');

const ICON_SVG = path.join(REPO_ROOT, 'design', 'app-icon.svg');
const APP_NAME = 'Your Personal Diary';

const FONT = '"Segoe UI", "Segoe UI Web (West European)", Arial, "Helvetica Neue", Helvetica, sans-serif';

function iconMarkup(size) {
  const svg = fs.readFileSync(ICON_SVG, 'utf8').replace(/width="1024" height="1024"/, `width="${size}" height="${size}"`);
  return svg;
}

/** A page whose body is exactly the image: icon (+ name) centred in the top two-thirds. */
function artworkHtml({ width, height, iconSize, nameSize, withName, transparent }) {
  // The icon and the name together sit centred inside the top two-thirds of the image.
  const nameBlock = withName ? Math.round(nameSize * 1.25) + Math.round(iconSize * 0.14) : 0;
  const groupHeight = iconSize + nameBlock;
  const topTwoThirds = Math.round((height * 2) / 3);
  const top = Math.max(0, Math.round((topTwoThirds - groupHeight) / 2));
  const background = transparent
    ? 'transparent'
    : 'radial-gradient(circle at 50% 28%, #ffffff 0%, #f4f6f9 45%, #e2eaf6 100%)';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
  body { background: ${background}; font-family: ${FONT}; }
  .group { position: absolute; top: ${top}px; left: 0; width: ${width}px; display: flex; flex-direction: column; align-items: center; }
  .icon { width: ${iconSize}px; height: ${iconSize}px; display: block; filter: ${transparent ? 'none' : 'drop-shadow(0 18px 34px rgba(27, 47, 79, 0.22))'}; }
  .icon svg { display: block; }
  .name { margin-top: ${Math.round(iconSize * 0.14)}px; font-size: ${nameSize}px; line-height: 1.25; font-weight: 700; letter-spacing: 0.01em; color: #1b2f4f; text-align: center; white-space: nowrap; }
</style></head>
<body>
  <div class="group">
    <div class="icon">${iconMarkup(iconSize)}</div>
    ${withName ? `<div class="name">${APP_NAME}</div>` : ''}
  </div>
</body></html>`;
}

export const LOGOS = [
  { file: 'app-tile-icon-300x300.png', width: 300, height: 300, iconSize: 300, nameSize: 0, withName: false, transparent: true, label: '1:1 App tile icon (300 x 300)' },
  { file: 'box-art-1080x1080.png', width: 1080, height: 1080, iconSize: 440, nameSize: 72, withName: true, transparent: false, label: '1:1 box art (1080 x 1080)' },
  { file: 'poster-art-720x1080.png', width: 720, height: 1080, iconSize: 400, nameSize: 60, withName: true, transparent: false, label: '2:3 poster art (720 x 1080)' },
];

export async function renderLogos() {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const produced = [];
  try {
    for (const logo of LOGOS) {
      const context = await browser.newContext({ viewport: { width: logo.width, height: logo.height }, deviceScaleFactor: 1, colorScheme: 'light' });
      const page = await context.newPage();
      await page.setContent(artworkHtml(logo), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      const file = path.join(LOGOS_DIR, logo.file);
      await page.screenshot({ path: file, type: 'png', fullPage: false, omitBackground: logo.transparent });
      await context.close();
      produced.push({ file, bytes: fs.statSync(file).size, label: logo.label });
      console.log(`${logo.label} -> ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
    }
  } finally {
    await browser.close();
  }
  return produced;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
if (isMain) {
  renderLogos().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
