// Builds the owner's Google Play folder next to the project folder (C:\Users\AVI\Projects - the owner keeps the
// kit folders there, not on the Desktop) from the Play kit (read-only on the project). An existing destination is
// refused.
//   node scripts/play/assemble-desktop-folder.mjs                             -> <parent of the project>\Your Personal Diary - Google Play
//   node scripts/play/assemble-desktop-folder.mjs <folder>                    -> any other new folder (a test run)
//   node scripts/play/assemble-desktop-folder.mjs --refresh-guides [<folder>] -> re-render only the Hebrew guide pages
// The guides are rendered by scripts/lib/guide-html.mjs (code blocks, "* " bullets and links included).
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guidePage, guideToHtml } from '../lib/guide-html.mjs';

const proj = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { mdToPlain } = await import(pathToFileURL(path.join(proj, 'store', 'render.mjs')).href);
const settings = JSON.parse(readFileSync(path.join(proj, 'legal', 'settings.json'), 'utf8'));
const args = process.argv.slice(2);
const refresh = args.includes('--refresh-guides');
const target = args.find((a) => !a.startsWith('--'));
const dst = target ? path.resolve(target) : path.join(path.dirname(proj), 'Your Personal Diary - Google Play');
if (refresh ? !existsSync(dst) : existsSync(dst)) {
  console.error(refresh ? `no such folder to refresh: ${dst}` : `exists already - not overwriting: ${dst}`);
  process.exit(1);
}
const fill = (s) =>
  s
    .replaceAll('{{PUBLISHER_NAME}}', settings.publisherName)
    .replaceAll('{{CONTACT_EMAIL}}', settings.contactEmail)
    .replaceAll('{{REVIEW_USERNAME}}', 'stor')
    .replaceAll('{{REVIEW_PASSWORD}}', '(type the password only in Play Console)');
const htmlFrom = (src, out) => {
  const r = guideToHtml(fill(readFileSync(src, 'utf8')));
  writeFileSync(out, guidePage(r.title, r.body));
};
const GUIDES = [
  [path.join(proj, 'docs', 'PLAY-RELEASE.he.md'), '1 - מדריך - פתח אותי קודם.html'],
  [path.join(proj, 'play', 'README.he.md'), '1b - מה יש בתיקייה.html'],
  [path.join(proj, 'play', 'screenshots', 'README.he.md'), path.join('3 - צילומי מסך לפי שפה', 'הסבר על הצילומים.html')],
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

mkdirSync(dst);
// 2 texts, 3 screenshots, 4 graphics
cpSync(path.join(proj, 'play', 'listing'), path.join(dst, '2 - טקסטים לחנות לפי שפה'), { recursive: true });
const shotsDst = path.join(dst, '3 - צילומי מסך לפי שפה');
mkdirSync(shotsDst);
for (const d of readdirSync(path.join(proj, 'play', 'screenshots'), { withFileTypes: true })) if (d.isDirectory()) cpSync(path.join(proj, 'play', 'screenshots', d.name), path.join(shotsDst, d.name), { recursive: true });
cpSync(path.join(proj, 'play', 'graphics'), path.join(dst, '4 - אייקון ותמונת כותרת'), { recursive: true });
// 1, 1b and the screenshots explanation - the Hebrew guides as web pages
writeGuides();
// 5 policy answers as plain text
const pol = path.join(dst, '5 - תשובות לטפסים של Google');
mkdirSync(pol);
const names = { 'data-safety.md': 'בטיחות נתונים - Data safety.txt', 'content-rating.md': 'דירוג תוכן - Content rating.txt', 'target-audience.md': 'קהל יעד - Target audience.txt', 'app-access.md': 'גישה לבודקים - App access.txt' };
const bom = '\ufeff';
for (const [src, out] of Object.entries(names)) writeFileSync(path.join(pol, out), bom + mdToPlain(fill(readFileSync(path.join(proj, 'play', 'policy', src), 'utf8'))).replace(/\n/g, '\r\n'));
// 6 app bundle note
const pkg = path.join(dst, '6 - קובץ האפליקציה לחנות');
mkdirSync(pkg);
writeFileSync(path.join(pkg, 'קרא אותי.txt'), bom + ['Google Play מקבלת קובץ מסוג AAB חתום, ולא קובץ APK.', 'הקובץ נבנה אחרי שתיצור את מפתח ההעלאה שלך (המדריך, חלק א). את הבנייה עושה מפתח, או עוזר AI שעובד על הפרויקט במחשב הזה (המדריך, חלק ב).', 'את קובץ ה-APK לבדיקה בטלפון שלך תמצא בתיקייה Your Personal Diary - installers.'].join('\r\n') + '\r\n');
writeFileSync(path.join(dst, 'קישורים.txt'), bom + ['מדיניות פרטיות (Privacy policy):', 'https://yourpersonaldiary.fly.dev/privacy/', '', 'דף מחיקת חשבון (Delete account URL):', 'https://yourpersonaldiary.fly.dev/delete-account/', '', 'תנאי שימוש (Terms of Use):', 'https://yourpersonaldiary.fly.dev/terms/', '', 'תמיכה ושאלות נפוצות (Support):', 'https://yourpersonaldiary.fly.dev/support/', '', 'אתר (Website):', 'https://yourpersonaldiary.fly.dev/', '', 'מייל קשר (Contact email):', settings.contactEmail, '', 'חשבון לבודקים של Google (App access): שם המשתמש stor. את הסיסמה הקלד רק ב-Play Console, לא בקובץ ולא בצ\'אט.'].join('\r\n') + '\r\n');
const count = (p, f) => readdirSync(p, { recursive: true }).filter(f).length;
console.log('folder:', dst);
console.log('listing langs:', readdirSync(path.join(dst, '2 - טקסטים לחנות לפי שפה')).length, '| screenshot langs:', readdirSync(shotsDst, { withFileTypes: true }).filter((d) => d.isDirectory()).length, '| png:', count(shotsDst, (n) => String(n).endsWith('.png')));
const leftovers = readdirSync(dst, { recursive: true }).filter((n) => /\.(txt|html)$/.test(n)).filter((n) => readFileSync(path.join(dst, n), 'utf8').replace(/\{\{\.\.\.\}\}/g, '').includes('{{'));
console.log('files with placeholders left:', leftovers.length ? leftovers : 'none');
