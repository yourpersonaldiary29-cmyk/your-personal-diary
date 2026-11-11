#!/usr/bin/env node
/**
 * Builds the owner's Microsoft Store folder (default: Desktop\"Your Personal Diary - Microsoft Store")
 * from the Store kit, like scripts/play/assemble-desktop-folder.mjs does for Google Play and
 * scripts/appstore/assemble-desktop-folder.mjs for the App Store. Read-only on the project except that it
 * first runs `node store/render.mjs` (which rewrites the generated, git-ignored store/out/). It never
 * overwrites: an existing destination is refused.
 *
 *   node scripts/store/assemble-desktop-folder.mjs            -> Desktop\Your Personal Diary - Microsoft Store
 *   node scripts/store/assemble-desktop-folder.mjs <folder>   -> any other new folder (a test run)
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const proj = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dst = process.argv[2] ? path.resolve(process.argv[2]) : path.join(process.env.USERPROFILE ?? '', 'Desktop', 'Your Personal Diary - Microsoft Store');
if (existsSync(dst)) {
  console.error(`exists already - not overwriting: ${dst}`);
  process.exit(1);
}
const settings = JSON.parse(readFileSync(path.join(proj, 'legal', 'settings.json'), 'utf8'));

// store/out/: the texts with the placeholders filled, the plain-text copies and the guide as a web page.
execFileSync(process.execPath, [path.join(proj, 'store', 'render.mjs')], { cwd: proj, stdio: 'inherit' });
const out = path.join(proj, 'store', 'out');

mkdirSync(dst, { recursive: true });
cpSync(path.join(out, 'STORE-RELEASE.he.html'), path.join(dst, '1 - מדריך - פתח אותי קודם.html'));
cpSync(path.join(out, 'listing'), path.join(dst, '2 - טקסטים לחנות לפי שפה'), { recursive: true });

const shotsSrc = path.join(proj, 'store', 'screenshots');
const shotsDst = path.join(dst, '3 - צילומי מסך לפי שפה');
mkdirSync(shotsDst);
for (const d of readdirSync(shotsSrc, { withFileTypes: true })) {
  if (d.isDirectory() && /^[a-z]{2}-[A-Z]{2}$/.test(d.name)) cpSync(path.join(shotsSrc, d.name), path.join(shotsDst, d.name), { recursive: true });
}
cpSync(path.join(shotsSrc, 'logos'), path.join(dst, '4 - לוגואים'), { recursive: true });
cpSync(path.join(out, 'txt'), path.join(dst, '5 - הערות לבודקים, דירוג גיל ורשימת בדיקה'), { recursive: true });

const BOM = '﻿';
const txt = (lines) => BOM + lines.join('\r\n') + '\r\n';
const pkg = path.join(dst, '6 - חבילת ההתקנה לחנות');
mkdirSync(pkg);
writeFileSync(
  path.join(pkg, 'קרא אותי.txt'),
  txt([
    'חבילת ההתקנה לחנות (קובץ MSIX) נבנית רק אחרי שתירשם לחנות ותשמור את השם Your Personal Diary.',
    'אחרי שמירת השם מופיעים בדף Product identity שלושה ערכים. מכניסים אותם לקובץ store\\identity.json (המדריך, חלק ג).',
    'את החבילה בונה מפתח, או עוזר AI שעובד על הפרויקט במחשב הזה, לפי המדריך (חלק ד) והקובץ store\\MSIX-BUILD.md:',
    '  npm run tauri:build',
    '  node scripts/store/build-msix.mjs',
    '  node scripts/store/check-msix.mjs --release   (חייב להסתיים ב-PASSED)',
  ]),
);
const SITE = 'https://yourpersonaldiary.fly.dev';
writeFileSync(
  path.join(dst, 'קישורים.txt'),
  txt([
    'מדיניות פרטיות (Privacy policy URL):',
    `${SITE}/privacy/`,
    '',
    'תנאי שימוש (Terms of Use):',
    `${SITE}/terms/`,
    '',
    'תמיכה ושאלות נפוצות (Support):',
    `${SITE}/support/`,
    '',
    'דף מחיקת חשבון:',
    `${SITE}/delete-account/`,
    '',
    'אתר האפליקציה (Website):',
    `${SITE}/`,
    '',
    'מייל תמיכה (Support contact):',
    settings.contactEmail,
    '',
    "חשבון ההדגמה לבודקים: שם המשתמש stor. את הסיסמה הקלד רק בטופס של מיקרוסופט (Notes for certification), לא בקובץ ולא בצ'אט.",
  ]),
);

const count = (dir, test) => readdirSync(dir, { recursive: true }).map(String).filter(test).length;
const leftovers = readdirSync(dst, { recursive: true })
  .map(String)
  .filter((n) => /\.(txt|html)$/.test(n))
  .filter((n) => readFileSync(path.join(dst, n), 'utf8').includes('{{'));
console.log('folder:', dst);
console.log('listing languages:', readdirSync(path.join(dst, '2 - טקסטים לחנות לפי שפה')).length, '| screenshot languages:', readdirSync(shotsDst).length, '| png:', count(shotsDst, (n) => n.endsWith('.png')));
console.log('files with placeholders left:', leftovers.length ? leftovers : 'none');
