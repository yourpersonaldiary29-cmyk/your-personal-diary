#!/usr/bin/env node
/**
 * Builds the owner's App Store folder (default: "Your Personal Diary - App Store" next to the project folder,
 * i.e. C:\Users\AVI\Projects - the owner keeps the kit folders there, not on the Desktop) from the
 * App Store kit in appstore/, the same way scripts/play/assemble-desktop-folder.mjs builds the Google
 * Play folder. Read-only on the project; it never overwrites a folder: an existing destination is refused.
 *
 *   node scripts/appstore/assemble-desktop-folder.mjs                            -> <parent of the project>\Your Personal Diary - App Store
 *   node scripts/appstore/assemble-desktop-folder.mjs <folder>                   -> any other new folder (a test run)
 *   node scripts/appstore/assemble-desktop-folder.mjs --refresh-guides [<folder>] -> re-render only the Hebrew guide
 *                                                                                  pages (.html) inside an existing folder
 *
 * The guides are rendered by scripts/lib/guide-html.mjs (code blocks, "* " bullets and links included).
 * The screenshots (appstore/screenshots/**.png) are git-ignored: render them first
 * (node scripts/play/render-screenshots.mjs --profile iphone-medium / iphone-large / mac) and check them
 * with node scripts/appstore/check-screenshots.mjs, or the folder is refused.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guidePage, guideToHtml } from '../lib/guide-html.mjs';

const proj = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { mdToPlain } = await import(pathToFileURL(path.join(proj, 'store', 'render.mjs')).href);
const settings = JSON.parse(readFileSync(path.join(proj, 'legal', 'settings.json'), 'utf8'));
const args = process.argv.slice(2);
const refresh = args.includes('--refresh-guides');
const target = args.find((a) => !a.startsWith('--'));
const dst = target ? path.resolve(target) : path.join(path.dirname(proj), 'Your Personal Diary - App Store');
if (refresh ? !existsSync(dst) : existsSync(dst)) {
  console.error(refresh ? `no such folder to refresh: ${dst}` : `exists already - not overwriting: ${dst}`);
  process.exit(1);
}

const kit = path.join(proj, 'appstore');
const count = (dir, test) => readdirSync(dir, { recursive: true }).filter((n) => test(String(n))).length;

const SITE = 'https://yourpersonaldiary.fly.dev';
const fill = (s) =>
  s
    .replaceAll('{{PUBLISHER_NAME}}', settings.publisherName)
    .replaceAll('{{CONTACT_EMAIL}}', settings.contactEmail)
    .replaceAll('{{REVIEW_USERNAME}}', 'stor')
    .replaceAll('{{REVIEW_PASSWORD}}', '(type the password only in App Store Connect)');
const htmlFrom = (src, out) => {
  const r = guideToHtml(fill(readFileSync(src, 'utf8')));
  writeFileSync(out, guidePage(r.title, r.body));
};
const BOM = '\ufeff';
const txt = (lines) => BOM + lines.join('\r\n') + '\r\n';

/** Every Hebrew guide page of the folder: [source, folder-relative output]. */
const GUIDES = [
  [path.join(kit, 'CHECKLIST.he.md'), '1 - מדריך - פתח אותי קודם.html'],
  [path.join(kit, 'ANSWERS.he.md'), '1b - תשובות לכל השדות של App Store Connect.html'],
  [path.join(kit, 'README.he.md'), '1c - מה יש בתיקייה.html'],
  [path.join(kit, 'screenshots', 'README.he.md'), path.join('3 - צילומי מסך', 'הסבר על הצילומים.html')],
  [path.join(proj, 'docs', 'MAC-RELEASE.he.md'), path.join('6 - בניית האפליקציות במק', 'אפליקציית Mac - מדריך.html')],
  [path.join(proj, 'scripts', 'ios', 'README.he.md'), path.join('6 - בניית האפליקציות במק', 'אפליקציית iPhone - מדריך.html')],
];
const writeGuides = () => {
  for (const [src, rel] of GUIDES) {
    mkdirSync(path.dirname(path.join(dst, rel)), { recursive: true });
    htmlFrom(src, path.join(dst, rel));
  }
};

if (refresh) {
  writeGuides();
  console.log(`refreshed ${GUIDES.length} guide pages in ${dst}`);
  process.exit(0);
}

const pngs = count(path.join(kit, 'screenshots'), (n) => n.endsWith('.png'));
if (pngs === 0) {
  console.error('appstore/screenshots has no PNG files (they are git-ignored) - render them first, see the comment at the top');
  process.exit(1);
}

mkdirSync(dst, { recursive: true });

// 2 - store texts per language (one folder per App Store Connect localization; bg cannot be entered)
cpSync(path.join(kit, 'listing'), path.join(dst, '2 - טקסטים לחנות לפי שפה'), { recursive: true });

// 3 - screenshots: iphone-6.3, iphone-6.9, mac
const shotsDst = path.join(dst, '3 - צילומי מסך');
mkdirSync(shotsDst);
for (const d of readdirSync(path.join(kit, 'screenshots'), { withFileTypes: true })) {
  if (d.isDirectory()) cpSync(path.join(kit, 'screenshots', d.name), path.join(shotsDst, d.name), { recursive: true });
}

// 4 - the 1024x1024 App Store icon
const iconDst = path.join(dst, '4 - אייקון');
mkdirSync(iconDst);
for (const f of ['AppIcon-1024.png', 'README.md']) cpSync(path.join(kit, 'icon', f), path.join(iconDst, f));

// 5 - the policy answers (English, as plain text that Notepad shows well) and the review notes as they are
const polDst = path.join(dst, '5 - תשובות לטפסים של אפל (באנגלית)');
mkdirSync(polDst);
const policyNames = {
  'app-privacy.md': 'App Privacy - פרטיות האפליקציה.txt',
  'age-rating.md': 'Age Rating - דירוג גיל.txt',
  'export-compliance.md': 'Export Compliance - הצפנה.txt',
  'app-information.md': 'App Information - פרטי האפליקציה.txt',
  'testflight.md': 'TestFlight - בדיקות.txt',
  'mac-appstore-notes.md': 'Mac App Store - מה שונה במק.txt',
};
for (const [src, out] of Object.entries(policyNames)) {
  writeFileSync(path.join(polDst, out), BOM + mdToPlain(fill(readFileSync(path.join(kit, 'policy', src), 'utf8'))).replace(/\r?\n/g, '\r\n'));
}
writeFileSync(
  path.join(polDst, 'App Review Notes - הערות לבודקים (להדביק כמו שהוא).txt'),
  BOM + readFileSync(path.join(kit, 'policy', 'review-notes.txt'), 'utf8').replace(/\r?\n/g, '\r\n'),
);

// 1, 1b, 1c, the screenshots explanation and 6 - the Hebrew guides as web pages
writeGuides();

writeFileSync(
  path.join(dst, 'קישורים.txt'),
  txt([
    'מדיניות פרטיות (Privacy Policy URL):',
    `${SITE}/privacy/`,
    '',
    'תנאי שימוש (Terms of Use / EULA - אם תתבקש כתובת):',
    `${SITE}/terms/`,
    '',
    'תמיכה (Support URL):',
    `${SITE}/support/`,
    '',
    'אתר (Marketing URL - אפשר להשאיר ריק):',
    `${SITE}/`,
    '',
    'מייל קשר (Contact email):',
    settings.contactEmail,
    '',
    'זכויות יוצרים (Copyright) - בלי הסימן ©, אפל מוסיפה אותו:',
    `2026 ${settings.publisherName}`,
    '',
    'מזהי האפליקציות (Bundle ID):',
    'iPhone: app.yourpersonaldiary',
    'Mac: app.yourpersonaldiary.mac',
    '',
    'חשבון לבודקים של אפל (Sign-in required): שם המשתמש stor. את הסיסמה הקלד רק ב-App Store Connect, לא בקובץ ולא בצ\'אט.',
  ]),
);

const leftovers = readdirSync(dst, { recursive: true })
  .map(String)
  .filter((n) => /\.(txt|html)$/.test(n))
  .filter((n) => readFileSync(path.join(dst, n), 'utf8').replaceAll('{{MINIMUM_AGE}}', '').includes('{{'));
console.log('folder:', dst);
console.log('listing folders:', readdirSync(path.join(dst, '2 - טקסטים לחנות לפי שפה')).length, '| screenshot PNGs:', count(shotsDst, (n) => n.endsWith('.png')));
console.log('files with placeholders left:', leftovers.length ? leftovers : 'none');
