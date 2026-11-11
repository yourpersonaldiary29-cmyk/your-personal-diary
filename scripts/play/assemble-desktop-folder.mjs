// Builds the owner's Google Play folder on the Desktop from the Play kit (read-only on the project).
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const proj = 'C:/Users/AVI/Projects/my-personal-diary';
const { mdToHtml, mdToPlain } = await import(pathToFileURL(path.join(proj, 'store', 'render.mjs')).href);
const settings = JSON.parse(readFileSync(path.join(proj, 'legal', 'settings.json'), 'utf8'));
const dst = path.join(process.env.USERPROFILE, 'Desktop', 'Your Personal Diary - Google Play');
if (existsSync(dst)) { console.error('exists already - not overwriting'); process.exit(1); }
mkdirSync(dst);
const fill = (s) => s.replaceAll('{{PUBLISHER_NAME}}', settings.publisherName).replaceAll('{{CONTACT_EMAIL}}', settings.contactEmail)
  .replaceAll('{{REVIEW_USERNAME}}', 'stor').replaceAll('{{REVIEW_PASSWORD}}', '(type the password only in Play Console)');
const page = (title, body) => `<!DOCTYPE html>\n<html lang="he" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n<style>\n:root{color-scheme:light dark;--bg:#fff;--text:#1c2430;--accent:#1f5fa8;--line:#d5dbe3;--box:#f3f6fa}\n@media (prefers-color-scheme:dark){:root{--bg:#14181f;--text:#e8ecf2;--accent:#8fc1ff;--line:#3a4352;--box:#1d232d}}\nbody{margin:0;background:var(--bg);color:var(--text);font-family:"Segoe UI",system-ui,Arial,sans-serif;line-height:1.7}\nmain{max-width:52rem;margin:0 auto;padding:1.5rem 1.25rem 3rem}\nh2{margin-top:2.2rem;padding-top:1rem;border-top:1px solid var(--line)}\ncode{direction:ltr;unicode-bidi:isolate;background:var(--box);border:1px solid var(--line);border-radius:.25rem;padding:.05rem .3rem;font-family:Consolas,monospace;overflow-wrap:anywhere;user-select:all}\npre{direction:ltr;background:var(--box);padding:.75rem;overflow-x:auto}\ntable{border-collapse:collapse;width:100%}td,th{border:1px solid var(--line);padding:.4rem .6rem;text-align:start;vertical-align:top}\na{color:var(--accent)}\n</style>\n</head>\n<body><main>\n${body}\n</main></body>\n</html>\n`;
// 1 guide
const g = mdToHtml(fill(readFileSync(path.join(proj, 'docs', 'PLAY-RELEASE.he.md'), 'utf8')));
writeFileSync(path.join(dst, '1 - מדריך - פתח אותי קודם.html'), page(g.title, g.body));
const r = mdToHtml(fill(readFileSync(path.join(proj, 'play', 'README.he.md'), 'utf8')));
writeFileSync(path.join(dst, '1b - מה יש בתיקייה.html'), page(r.title, r.body));
// 2 texts, 3 screenshots, 4 graphics
cpSync(path.join(proj, 'play', 'listing'), path.join(dst, '2 - טקסטים לחנות לפי שפה'), { recursive: true });
const shotsDst = path.join(dst, '3 - צילומי מסך לפי שפה');
mkdirSync(shotsDst);
for (const d of readdirSync(path.join(proj, 'play', 'screenshots'), { withFileTypes: true })) if (d.isDirectory()) cpSync(path.join(proj, 'play', 'screenshots', d.name), path.join(shotsDst, d.name), { recursive: true });
const sr = mdToHtml(readFileSync(path.join(proj, 'play', 'screenshots', 'README.he.md'), 'utf8'));
writeFileSync(path.join(shotsDst, 'הסבר על הצילומים.html'), page(sr.title, sr.body));
cpSync(path.join(proj, 'play', 'graphics'), path.join(dst, '4 - אייקון ותמונת כותרת'), { recursive: true });
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
const leftovers = readdirSync(dst, { recursive: true }).filter((n) => /\.(txt|html)$/.test(n)).filter((n) => readFileSync(path.join(dst, n), 'utf8').includes('{{'));
console.log('files with placeholders left:', leftovers.length ? leftovers : 'none');
