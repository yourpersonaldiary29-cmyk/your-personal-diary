#!/usr/bin/env node
/**
 * Builds the owner's App Store folder (default: Desktop\"Your Personal Diary - App Store") from the
 * App Store kit in appstore/, the same way scripts/play/assemble-desktop-folder.mjs builds the Google
 * Play folder. Read-only on the project; it never overwrites: an existing destination is refused.
 *
 *   node scripts/appstore/assemble-desktop-folder.mjs              -> Desktop\Your Personal Diary - App Store
 *   node scripts/appstore/assemble-desktop-folder.mjs <folder>     -> any other new folder (a test run)
 *
 * The screenshots (appstore/screenshots/**.png) are git-ignored: render them first
 * (node scripts/play/render-screenshots.mjs --profile iphone-medium / iphone-large / mac) and check them
 * with node scripts/appstore/check-screenshots.mjs, or the folder is refused.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const proj = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { mdToHtml, mdToPlain } = await import(pathToFileURL(path.join(proj, 'store', 'render.mjs')).href);
const settings = JSON.parse(readFileSync(path.join(proj, 'legal', 'settings.json'), 'utf8'));
const dst = process.argv[2] ? path.resolve(process.argv[2]) : path.join(process.env.USERPROFILE ?? '', 'Desktop', 'Your Personal Diary - App Store');
if (existsSync(dst)) {
  console.error(`exists already - not overwriting: ${dst}`);
  process.exit(1);
}

const kit = path.join(proj, 'appstore');
const count = (dir, test) => readdirSync(dir, { recursive: true }).filter((n) => test(String(n))).length;
const pngs = count(path.join(kit, 'screenshots'), (n) => n.endsWith('.png'));
if (pngs === 0) {
  console.error('appstore/screenshots has no PNG files (they are git-ignored) - render them first, see the comment at the top');
  process.exit(1);
}

const SITE = 'https://yourpersonaldiary.fly.dev';
const fill = (s) =>
  s
    .replaceAll('{{PUBLISHER_NAME}}', settings.publisherName)
    .replaceAll('{{CONTACT_EMAIL}}', settings.contactEmail)
    .replaceAll('{{REVIEW_USERNAME}}', 'stor')
    .replaceAll('{{REVIEW_PASSWORD}}', '(type the password only in App Store Connect)');
// The guide renderer knows bare links only: [text](url) becomes "text (url)" first.
const links = (s) => s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => (text === url ? url : `${text} (${url})`));

const page = (title, body) => `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--text:#1c2430;--accent:#1f5fa8;--line:#d5dbe3;--box:#f3f6fa}
@media (prefers-color-scheme:dark){:root{--bg:#14181f;--text:#e8ecf2;--accent:#8fc1ff;--line:#3a4352;--box:#1d232d}}
body{margin:0;background:var(--bg);color:var(--text);font-family:"Segoe UI",system-ui,Arial,sans-serif;line-height:1.7}
main{max-width:52rem;margin:0 auto;padding:1.5rem 1.25rem 3rem}
h2{margin-top:2.2rem;padding-top:1rem;border-top:1px solid var(--line)}
code{direction:ltr;unicode-bidi:isolate;background:var(--box);border:1px solid var(--line);border-radius:.25rem;padding:.05rem .3rem;font-family:Consolas,monospace;overflow-wrap:anywhere;user-select:all}
pre{direction:ltr;background:var(--box);padding:.75rem;overflow-x:auto}
table{border-collapse:collapse;width:100%}td,th{border:1px solid var(--line);padding:.4rem .6rem;text-align:start;vertical-align:top}
a{color:var(--accent)}
</style>
</head>
<body><main>
${body}
</main></body>
</html>
`;
const htmlFrom = (src, out) => {
  const r = mdToHtml(links(fill(readFileSync(src, 'utf8'))));
  writeFileSync(out, page(r.title, r.body));
};
const BOM = '﻿';
const txt = (lines) => BOM + lines.join('\r\n') + '\r\n';

mkdirSync(dst, { recursive: true });

// 1 - the guides (Hebrew)
htmlFrom(path.join(kit, 'CHECKLIST.he.md'), path.join(dst, '1 - מדריך - פתח אותי קודם.html'));
htmlFrom(path.join(kit, 'ANSWERS.he.md'), path.join(dst, '1b - תשובות לכל השדות של App Store Connect.html'));
htmlFrom(path.join(kit, 'README.he.md'), path.join(dst, '1c - מה יש בתיקייה.html'));

// 2 - store texts per language (one folder per App Store Connect localization; bg cannot be entered)
cpSync(path.join(kit, 'listing'), path.join(dst, '2 - טקסטים לחנות לפי שפה'), { recursive: true });

// 3 - screenshots: iphone-6.3, iphone-6.9, mac (+ the Hebrew explanation)
const shotsDst = path.join(dst, '3 - צילומי מסך');
mkdirSync(shotsDst);
for (const d of readdirSync(path.join(kit, 'screenshots'), { withFileTypes: true })) {
  if (d.isDirectory()) cpSync(path.join(kit, 'screenshots', d.name), path.join(shotsDst, d.name), { recursive: true });
}
htmlFrom(path.join(kit, 'screenshots', 'README.he.md'), path.join(shotsDst, 'הסבר על הצילומים.html'));

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

// 6 - building the apps on the Mac (needs the newer macOS and Xcode - see the guides)
const macDst = path.join(dst, '6 - בניית האפליקציות במק');
mkdirSync(macDst);
htmlFrom(path.join(proj, 'docs', 'MAC-RELEASE.he.md'), path.join(macDst, 'אפליקציית Mac - מדריך.html'));
htmlFrom(path.join(proj, 'scripts', 'ios', 'README.he.md'), path.join(macDst, 'אפליקציית iPhone - מדריך.html'));

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
