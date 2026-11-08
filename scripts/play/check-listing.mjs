#!/usr/bin/env node
/**
 * scripts/play/check-listing.mjs - validates the Google Play store-listing texts in play/listing/.
 *
 *   node scripts/play/check-listing.mjs              check play/listing/ (exit code 1 on any problem)
 *   node scripts/play/check-listing.mjs --dir <dir>  check another folder with the same layout (the tests)
 *
 * Layout: play/listing/<Play locale>/{title.txt, short.txt, full.txt}, one folder per locale of the
 * app, named with the code the Play Console uses for that language (PLAY_LOCALES below; Hebrew is
 * "iw-IL" there, the pre-1989 ISO code, not "he-IL").
 *
 * What is checked, with the source of each rule (fetched 2026-10-26):
 *   - Google Play Developer Policy Center, "Metadata" (support.google.com/googleplay/android-developer/answer/9898842):
 *     "Your app title must be 30 characters or less"; no emojis, emoticons or repeated special
 *     characters; "Avoid ALL CAPS unless it is part of your brand name"; no store-performance claims
 *     ("#1", "Best", "Top", "Popular"), no price or promotional claims ("free for limited time only"),
 *     no Play-program references ("Editor's choice", "New"), no unattributed testimonials, no
 *     "word blocks and vertical or horizontal word lists" (keyword stuffing).
 *   - Play Console Help, "Add preview assets" (support.google.com/googleplay/android-developer/answer/9866151):
 *     short description "80 character limit", "Do not include special characters, line breaks,
 *     emojis, emoticons, repeated punctuation", "Do not use capitalization for emphasis", no
 *     "Unnecessary keywords in an attempt to improve search results", no calls to action
 *     ("download now", "install now", "try now").
 *   - Play Console Help, "Create and set up your app" (answer/9859152): App name "30 character limit",
 *     Short description "80 character limit", Full description "4000 character limit"; full-width
 *     and half-width characters count the same.
 *   - Play Console Help, "Translate and localize your app" (answer/9844778): the language codes
 *     (Hebrew is "iw-IL" there, not "he-IL").
 *   - The project itself: the brand "Your Personal Diary" is the title in every language (README.md);
 *     the apps are server-based with sync between devices, so no text may claim that the diary is
 *     stored only on the device or that there is no cloud / no server (docs/play-tasks/PLAY-LISTING.md);
 *     the diary is encrypted at rest per account but decrypted in the server's memory while the user
 *     is signed in, and the operator holds the recovery-key escrow (the privacy policy says so,
 *     docs/play-tasks/PLAY-LEGAL.md), so no text may claim end-to-end or zero-knowledge encryption;
 *     no URL belongs in the texts (the privacy-policy and contact URLs have their own fields in the
 *     Play Console); every locale is a real translation written in its own script.
 *
 * Counting: Google says only that full-width and half-width characters count the same (one each), not
 * whether the Console counts code points or UTF-16 units; this script counts UTF-16 code units
 * (JavaScript's String.length, the stricter of the two) after turning CRLF into LF and dropping the
 * final line break. That is never smaller than a count of code points or of user-perceived
 * characters, so a text that passes here fits under any of the three. (Combining marks - Hindi
 * vowel signs, Thai tone marks - are code points of their own and are counted.)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_LISTING_DIR = path.join(ROOT, 'play', 'listing');

/** The product name, English in every language (README.md: "the brand is ALWAYS English"). */
export const BRAND = 'Your Personal Diary';

export const FILES = ['title.txt', 'short.txt', 'full.txt'];

/** Play's limits per field (sources in the header). */
export const LIMITS = { 'title.txt': 30, 'short.txt': 80, 'full.txt': 4000 };

/**
 * The 20 locales of the app with the code the Play Console uses for each ("Translate and localize
 * your app", answer/9844778), the app's own code, and the script(s) a real translation is written in.
 */
export const PLAY_LOCALES = {
  'en-US': { app: 'en', name: 'English (United States)', scripts: ['Latin'] },
  'iw-IL': { app: 'he', name: 'Hebrew', scripts: ['Hebrew'] },
  ar: { app: 'ar', name: 'Arabic', scripts: ['Arabic'] },
  'zh-CN': { app: 'zh', name: 'Chinese (Simplified)', scripts: ['Han'] },
  'ja-JP': { app: 'ja', name: 'Japanese', scripts: ['Hiragana', 'Katakana', 'Han'] },
  'hi-IN': { app: 'hi', name: 'Hindi', scripts: ['Devanagari'] },
  th: { app: 'th', name: 'Thai', scripts: ['Thai'] },
  'es-ES': { app: 'es', name: 'Spanish (Spain)', scripts: ['Latin'] },
  'pt-BR': { app: 'pt', name: 'Portuguese (Brazil)', scripts: ['Latin'] },
  'fr-FR': { app: 'fr', name: 'French (France)', scripts: ['Latin'] },
  'it-IT': { app: 'it', name: 'Italian', scripts: ['Latin'] },
  'de-DE': { app: 'de', name: 'German', scripts: ['Latin'] },
  ro: { app: 'ro', name: 'Romanian', scripts: ['Latin'] },
  'el-GR': { app: 'el', name: 'Greek', scripts: ['Greek'] },
  'pl-PL': { app: 'pl', name: 'Polish', scripts: ['Latin'] },
  'cs-CZ': { app: 'cs', name: 'Czech', scripts: ['Latin'] },
  'hu-HU': { app: 'hu', name: 'Hungarian', scripts: ['Latin'] },
  'ru-RU': { app: 'ru', name: 'Russian', scripts: ['Cyrillic'] },
  bg: { app: 'bg', name: 'Bulgarian', scripts: ['Cyrillic'] },
  'tr-TR': { app: 'tr', name: 'Turkish', scripts: ['Latin'] },
};

/** Acronyms that are legitimately written in capitals (file formats, the cipher). */
const ALLOWED_CAPS = new Set(['PDF', 'CSV', 'JSON', 'TXT', 'HTTPS', 'AES']);

/** Any web address: the texts contain none (Play has separate fields for the policy and contact links). */
const URL_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|app|io|dev|il|co|info|me)\b/i;

/** Emoji and pictographs (the metadata policy forbids them in titles, icons and descriptions). */
const EMOJI_RE = /\p{Extended_Pictographic}|️|[\u{1F000}-\u{1FAFF}]|[☀-➿]/u;

/** Repeated punctuation / special characters ("!!", "???", "...", "--", "***"). */
const REPEATED_RE = /[!?]{2,}|\.{3,}|-{2,}|[*#_~^=+%$&|<>]{2,}/;

/**
 * A word of four or more capital letters (Latin, Greek or Cyrillic) - "ALL CAPS" unless allow-listed.
 * JavaScript's \b only knows ASCII word characters (no boundary before "Ч" or "É"), so the word edges
 * are written with Unicode look-arounds.
 */
const CAPS_WORD_RE = /(?<![\p{L}\p{N}])\p{Lu}[\p{Lu}\p{Pd}]{3,}(?![\p{L}\p{N}])/gu;

/** A word boundary that also works between non-ASCII letters (Cyrillic, Greek, Czech...). */
const UNICODE_BOUNDARY = '(?:(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_])|(?<=[\\p{L}\\p{N}_])(?![\\p{L}\\p{N}_]))';

/** A claim pattern as a case-insensitive Unicode regular expression, its `\b` made Unicode-aware. */
function claimRe(source) {
  return new RegExp(source.replaceAll('\\b', UNICODE_BOUNDARY), 'iu');
}

/**
 * Claims the metadata policy forbids (store performance, price / promotion, Play programs, calls to
 * action), as they would be written in each language. Matched case-insensitively; a pattern is a
 * regular-expression source. '*' applies to every locale; the language lists only to their own text
 * (an English word such as "sale" is an ordinary word in Romanian or Spanish).
 */
const FORBIDDEN_CLAIMS = {
  '*': ['#\\s?1\\b', '№\\s?1\\b', 'million downloads'],
  en: [
    '\\bno\\.?\\s?1\\b',
    '\\bbest\\b',
    '\\btop\\b',
    '\\bpopular\\b',
    '\\bnew\\b',
    '\\bfree\\b',
    '\\bdiscount\\b',
    '\\bsale\\b',
    "editor'?s choice",
    '\\baward',
    '\\bdownload now\\b',
    '\\binstall now\\b',
    '\\btry now\\b',
    '\\bplay now\\b',
  ],
  he: ['הטוב ביותר', 'הכי טוב', 'מספר 1', 'מס\' 1', 'חינם', 'בחינם', 'הורידו עכשיו', 'התקינו עכשיו'],
  ar: ['الأفضل', 'رقم 1', 'مجاني', 'مجانا', 'مجانًا', 'حمل الآن', 'نزّل الآن'],
  zh: ['最好', '最佳', '第一', '免费', '立即下载', '立即安装'],
  ja: ['最高', '一番', '無料', '今すぐダウンロード', '今すぐインストール'],
  hi: ['सबसे अच्छा', 'सबसे अच्छी', 'नंबर 1', 'मुफ़्त', 'मुफ्त', 'फ़्री', 'अभी डाउनलोड'],
  th: ['ดีที่สุด', 'อันดับ 1', 'อันดับหนึ่ง', 'ฟรี', 'ดาวน์โหลดเลย'],
  es: ['\\bel mejor\\b', '\\bla mejor\\b', '\\bnúmero 1\\b', '\\bgratis\\b', '\\bgratuit[ao]\\b', 'descarga ahora', 'descárgala ahora'],
  pt: ['\\bo melhor\\b', '\\ba melhor\\b', '\\bnúmero 1\\b', '\\bgrátis\\b', '\\bgratuit[ao]\\b', 'baixe agora', 'instale agora'],
  fr: ['\\ble meilleur\\b', '\\bla meilleure\\b', '\\bnuméro 1\\b', '\\bgratuit', 'téléchargez maintenant', 'installez maintenant'],
  it: ['\\bil migliore\\b', '\\bla migliore\\b', '\\bnumero 1\\b', '\\bgratis\\b', '\\bgratuit[ao]\\b', 'scarica ora', 'installa ora'],
  de: ['\\bbeste[nrs]?\\b', '\\bnr\\.? ?1\\b', '\\bnummer 1\\b', '\\bkostenlos', '\\bgratis\\b', 'jetzt herunterladen', 'jetzt installieren'],
  ro: ['\\bcel mai bun', '\\bcea mai bună', '\\bnumărul 1\\b', '\\bgratuit', '\\bgratis\\b', 'descarcă acum', 'instalează acum'],
  el: ['καλύτερ', 'νούμερο 1', 'δωρεάν', 'κατεβάστε τώρα', 'εγκαταστήστε τώρα'],
  pl: ['najlepsz', '\\bnumer 1\\b', 'bezpłatn', 'darmow', 'pobierz teraz', 'zainstaluj teraz'],
  cs: ['nejlepší', '\\bčíslo 1\\b', '\\bzdarma\\b', 'stáhněte si hned', 'nainstalujte hned'],
  hu: ['legjobb', 'első számú', 'ingyen', 'töltsd le most', 'töltse le most'],
  ru: ['лучш', '\\bномер 1\\b', 'бесплатн', 'скачайте сейчас', 'установите сейчас'],
  bg: ['най-добр', '\\bномер 1\\b', 'безплатн', 'изтеглете сега', 'инсталирайте сега'],
  tr: ['\\ben iyi', '\\b1 numara', 'ücretsiz', 'bedava', 'hemen indir', 'hemen yükle'],
};

/**
 * Claims that stopped being true when the apps became server-based (docs/play-tasks/PLAY-LISTING.md):
 * "stored only on your device / computer / phone", "stays on your device", "never leaves your device",
 * "no cloud", "no server". Per language, as regular-expression sources, matched case-insensitively.
 */
const DEVICE_ONLY_CLAIMS = {
  en: [
    'only on (?:your|this) (?:own )?(?:device|phone|computer|pc)\\b',
    'stays? (?:on|with) (?:your|this) (?:own )?(?:device|phone|computer|pc)\\b',
    'never leaves? (?:your|this|the) (?:device|phone|computer|pc)\\b',
    '\\bno cloud\\b',
    'without (?:a|the) cloud',
    '\\bno server\\b',
    'stored only on',
  ],
  he: ['רק (?:במכשיר|בטלפון|במחשב)', 'נשאר (?:במכשיר|בטלפון|במחשב)', 'לא יוצא מה(?:מכשיר|טלפון|מחשב)', 'בלי ענן', 'ללא ענן', 'אין שרת', 'בלי שרת'],
  ar: ['فقط (?:على|في) (?:جهازك|هاتفك|حاسوبك)', 'لا (?:يغادر|تغادر) (?:جهازك|هاتفك)', 'بدون سحابة', 'دون سحابة', 'لا خادم'],
  zh: ['仅(?:保存|存储|储存)?在(?:您的|你的)?(?:设备|手机|电脑)', '只(?:保存|存储|储存)在', '不离开(?:您的|你的)?(?:设备|手机)', '无云', '没有云', '没有服务器'],
  ja: ['(?:端末|デバイス|スマートフォン|スマホ)(?:内|上)?(?:のみ|だけ)に', '(?:端末|スマホ)から(?:出|離れ)ません', 'クラウドなし', 'クラウドを使わ', 'サーバーなし'],
  hi: ['(?:केवल|सिर्फ़|सिर्फ) (?:आपके|इस) (?:डिवाइस|फ़ोन|फोन|कंप्यूटर)', 'क्लाउड नहीं', 'बिना क्लाउड', 'कोई सर्वर नहीं'],
  th: ['เฉพาะ(?:บน|ใน)(?:อุปกรณ์|โทรศัพท์|เครื่อง)', '(?:อุปกรณ์|โทรศัพท์)ของคุณเท่านั้น', 'ไม่มีคลาวด์', 'ไม่ใช้คลาวด์', 'ไม่มีเซิร์ฟเวอร์'],
  es: ['(?:solo|sólo|únicamente) en (?:tu|su|este) (?:dispositivo|teléfono|móvil|ordenador)', 'nunca sale de (?:tu|su) (?:dispositivo|teléfono|móvil)', 'sin nube', 'sin servidor'],
  pt: ['(?:apenas|somente|só) no (?:seu|teu|este) (?:dispositivo|telefone|celular|computador)', 'nunca sai do (?:seu|teu) (?:dispositivo|telefone|celular)', 'sem nuvem', 'sem servidor'],
  fr: ['(?:uniquement|seulement) sur (?:votre|ton|cet?) (?:appareil|téléphone|ordinateur)', 'ne quitte jamais (?:votre|ton) (?:appareil|téléphone)', 'sans cloud', 'sans nuage', 'sans serveur'],
  it: ['(?:solo|soltanto|unicamente) sul (?:tuo|suo|proprio|questo) (?:dispositivo|telefono|computer)', 'non lascia mai il (?:tuo|suo) (?:dispositivo|telefono)', 'senza cloud', 'senza server'],
  de: ['nur auf (?:deinem|ihrem|diesem) (?:gerät|handy|smartphone|telefon|computer|pc)', 'verlässt (?:dein|ihr|das) (?:gerät|handy|smartphone) nie', 'ohne cloud', 'ohne server'],
  ro: ['(?:doar|numai) pe (?:dispozitivul|telefonul|calculatorul) (?:tău|dumneavoastră|acesta)', 'nu părăsește niciodată (?:dispozitivul|telefonul)', 'fără cloud', 'fără server'],
  el: ['μόνο (?:στη|στο|στον) (?:συσκευή|τηλέφωνό|κινητό|υπολογιστή)', 'δεν φεύγει ποτέ από', 'χωρίς cloud', 'χωρίς νέφος', 'χωρίς διακομιστή'],
  pl: ['(?:tylko|wyłącznie) (?:na|w) (?:twoim|tym) (?:urządzeniu|telefonie|komputerze)', 'nigdy nie opuszcza (?:twojego|tego) (?:urządzenia|telefonu)', 'bez chmury', 'bez serwera'],
  cs: ['(?:jen|pouze) (?:na|ve?) (?:tvém|vašem|tomto) (?:zařízení|telefonu|počítači)', 'nikdy neopouští (?:tvé|vaše|toto) zařízení', 'bez cloudu', 'bez serveru'],
  hu: ['(?:csak|kizárólag) (?:a|ezen a) (?:készülék|telefon|eszköz|számítógép)', 'soha nem hagyja el a (?:készülék|telefon|eszköz)', 'felhő nélkül', 'szerver nélkül'],
  ru: ['только (?:на|в) (?:вашем|твоём|твоем|этом) (?:устройстве|телефоне|компьютере)', 'никогда не покидает (?:ваше|твоё|твое|это) устройство', 'без облака', 'без сервера'],
  bg: ['само (?:на|в) (?:вашето|твоето|това) (?:устройство|телефон|компютър)', 'никога не напуска (?:вашето|твоето|това) устройство', 'без облак', 'без сървър'],
  tr: ['(?:yalnızca|sadece) (?:cihazınızda|telefonunuzda|bilgisayarınızda|bu cihazda)', 'cihazınızdan (?:asla|hiç) (?:çıkmaz|ayrılmaz)', 'bulut yok', 'bulutsuz', 'sunucu yok', 'sunucusuz'],
};

/**
 * Encryption claims the hosted service cannot make: the server decrypts a diary in memory while its
 * owner is signed in, and the operator holds the recovery-key escrow (PLAY-LEGAL.md, the privacy
 * policy). So no "end-to-end", "zero-knowledge", "only you can read it", "not even we". The '*' list
 * applies to every locale (the English terms are often kept untranslated).
 */
const OVERCLAIMS = {
  '*': ['end[- ]to[- ]end', '\\be2ee?\\b', 'zero[- ]knowledge'],
  en: ['only you can (?:read|see|open)', 'nobody (?:else )?can (?:read|see|open)', 'not even (?:we|us)\\b'],
  he: ['מקצה לקצה', 'רק אתם יכולים לקרוא', 'רק את(?:ה)? יכול(?:ה)? לקרוא', 'אפילו לא אנחנו'],
  ar: ['من طرف إلى طرف', 'بين الطرفين', 'وحدك من يستطيع'],
  zh: ['端到端', '零知识', '只有您能', '只有你能', '连我们也'],
  ja: ['エンドツーエンド', 'ゼロ知識', 'あなただけが', '私たちでさえ'],
  hi: ['एंड-टू-एंड', 'एंड टू एंड', 'केवल आप ही पढ़', 'हम भी नहीं'],
  th: ['ต้นทางถึงปลายทาง', 'มีแต่คุณเท่านั้นที่', 'แม้แต่เราก็'],
  es: ['de extremo a extremo', 'solo tú puedes', 'ni siquiera nosotros'],
  pt: ['de ponta a ponta', 'só você pode', 'só o senhor', 'nem mesmo nós', 'nem nós'],
  fr: ['de bout en bout', 'vous seul pouvez', 'même pas nous', 'pas même nous'],
  it: ['solo tu puoi', 'nemmeno noi', 'neanche noi'],
  de: ['ende-zu-ende', 'nur du kannst', 'nicht einmal wir', 'selbst wir nicht'],
  ro: ['cap-coadă', 'cap la cap', 'doar tu poți', 'nici măcar noi'],
  el: ['από άκρο σε άκρο', 'μόνο εσύ μπορείς', 'ούτε καν εμείς'],
  pl: ['od końca do końca', 'tylko ty możesz', 'nawet my nie'],
  cs: ['koncov(?:é|ým) šifrován', 'jen ty můžeš', 'ani my ne'],
  hu: ['végponttól végpontig', 'csak te olvashatod', 'még mi sem'],
  ru: ['сквозн(?:ое|ым) шифрован', 'только вы можете', 'даже мы не'],
  bg: ['от край до край', 'само вие можете', 'дори ние не'],
  tr: ['uçtan uca', 'yalnızca siz okuyabilirsiniz', 'biz bile'],
};

/** How often one content word (five letters or more) may occur in full.txt - a coarse keyword-stuffing guard. */
const MAX_WORD_REPEATS = 15;

/** CRLF -> LF and the one final line break removed: the text as it is pasted into the Console. */
export function normalise(raw) {
  return raw.replace(/\r\n/g, '\n').replace(/\n$/, '');
}

/** The length Play's form reports for a text (UTF-16 code units of the normalised text). */
export function playLength(raw) {
  return normalise(raw).length;
}

function scriptShare(text, scripts) {
  const letters = [...text.replaceAll(BRAND, '')].filter((ch) => /\p{L}/u.test(ch));
  if (!letters.length) return 0;
  const inScript = letters.filter((ch) => scripts.some((s) => new RegExp(`\\p{Script=${s}}`, 'u').test(ch))).length;
  return inScript / letters.length;
}

/**
 * The problems of one text (an empty list when it is fine). `english` is the en-US text of the same
 * file (null for en-US itself), used to spot an untranslated copy.
 */
export function textProblems(locale, file, raw, english = null) {
  const problems = [];
  const def = PLAY_LOCALES[locale];
  if (!def) return [`${locale}: not a Play locale of the app`];
  if (raw.charCodeAt(0) === 0xfeff) problems.push('starts with a byte-order mark');
  if (!raw.endsWith('\n')) problems.push('does not end with a line break');
  if (/\n\n$/.test(raw.replace(/\r\n/g, '\n'))) problems.push('ends with an empty line');
  const text = normalise(raw);
  if (!text.trim()) problems.push('is empty');
  if (/\t/.test(text)) problems.push('contains a tab');
  if (/[  ]$/m.test(text)) problems.push('has a space at the end of a line');
  if (/^[  ]/m.test(text)) problems.push('has a space at the start of a line');
  if (/ {2}/.test(text)) problems.push('has two spaces in a row');
  if (/\n{3}/.test(text)) problems.push('has two empty lines in a row');
  if (/^\n/.test(text)) problems.push('starts with an empty line');

  const length = text.length;
  const limit = LIMITS[file];
  if (length > limit) problems.push(`is ${length} characters long, the limit is ${limit}`);

  if (file === 'title.txt' && text !== BRAND) problems.push(`must be exactly the brand "${BRAND}" (it is ${JSON.stringify(text)})`);
  if (file === 'short.txt' && text.includes('\n')) problems.push('the short description may not contain line breaks');
  if (file === 'full.txt' && !text.includes(BRAND)) problems.push(`does not name the app ("${BRAND}")`);

  if (URL_RE.test(text)) problems.push(`contains a web address (${URL_RE.exec(text)[0]})`);
  const emoji = EMOJI_RE.exec(text);
  if (emoji) problems.push(`contains an emoji or pictograph (${JSON.stringify(emoji[0])})`);
  const repeated = REPEATED_RE.exec(text);
  if (repeated) problems.push(`repeats punctuation (${JSON.stringify(repeated[0])})`);
  for (const [word] of text.matchAll(CAPS_WORD_RE)) {
    if (!ALLOWED_CAPS.has(word) && !BRAND.includes(word)) problems.push(`has a word in ALL CAPS (${word})`);
  }

  const claims = [...FORBIDDEN_CLAIMS['*'], ...(FORBIDDEN_CLAIMS[def.app] ?? [])];
  for (const source of claims) {
    const m = claimRe(source).exec(text.replaceAll(BRAND, ''));
    if (m) problems.push(`makes a claim the metadata policy forbids (${JSON.stringify(m[0])})`);
  }
  for (const source of DEVICE_ONLY_CLAIMS[def.app] ?? []) {
    const m = claimRe(source).exec(text);
    if (m) problems.push(`claims the diary is stored only on the device / that there is no server (${JSON.stringify(m[0])}) - the apps are server-based`);
  }
  for (const source of [...OVERCLAIMS['*'], ...(OVERCLAIMS[def.app] ?? [])]) {
    const m = claimRe(source).exec(text);
    if (m) problems.push(`claims end-to-end / zero-knowledge encryption (${JSON.stringify(m[0])}) - the server decrypts the diary while you are signed in (see the privacy policy)`);
  }

  if (file !== 'title.txt') {
    const share = scriptShare(text, def.scripts);
    if (share < 0.6) problems.push(`is not written in ${def.scripts.join(' / ')} (${Math.round(share * 100)}% of its letters are)`);
    if (english !== null && normalise(english) === text) problems.push('is the English text, not a translation');
  }

  if (file === 'full.txt') {
    const counts = new Map();
    for (const [word] of text.replaceAll(BRAND, '').toLowerCase().matchAll(/[\p{L}\p{M}]{5,}/gu)) counts.set(word, (counts.get(word) ?? 0) + 1);
    for (const [word, n] of counts) if (n > MAX_WORD_REPEATS) problems.push(`repeats the word "${word}" ${n} times (keyword stuffing?)`);
  }
  return problems;
}

/**
 * Checks a listing folder. Returns the rows (one per locale and file, with the length, the limit
 * and the problems) plus folder-level problems, and `ok`.
 */
export function checkListing(dir = DEFAULT_LISTING_DIR) {
  const rows = [];
  const problems = [];
  if (!existsSync(dir)) return { rows, problems: [`${dir} does not exist`], ok: false };
  const present = readdirSync(dir).filter((name) => statSync(path.join(dir, name)).isDirectory());
  const expected = Object.keys(PLAY_LOCALES);
  for (const locale of expected) if (!present.includes(locale)) problems.push(`locale folder missing: ${locale} (${PLAY_LOCALES[locale].name})`);
  for (const name of present) if (!expected.includes(name)) problems.push(`unexpected folder: ${name} (not a Play locale code of the app)`);

  const english = {};
  for (const file of FILES) {
    const p = path.join(dir, 'en-US', file);
    english[file] = existsSync(p) ? readFileSync(p, 'utf8') : null;
  }
  for (const locale of expected) {
    if (!present.includes(locale)) continue;
    for (const file of FILES) {
      const p = path.join(dir, locale, file);
      if (!existsSync(p)) {
        rows.push({ locale, file, length: null, limit: LIMITS[file], problems: ['missing'] });
        continue;
      }
      const raw = readFileSync(p, 'utf8');
      rows.push({
        locale,
        file,
        length: playLength(raw),
        limit: LIMITS[file],
        problems: textProblems(locale, file, raw, locale === 'en-US' ? null : english[file]),
      });
    }
    const extra = readdirSync(path.join(dir, locale)).filter((name) => !FILES.includes(name));
    if (extra.length) problems.push(`${locale}: unexpected file(s): ${extra.join(', ')}`);
  }
  const ok = problems.length === 0 && rows.every((r) => r.problems.length === 0);
  return { rows, problems, ok };
}

export function formatReport({ rows, problems, ok }) {
  const lines = [];
  for (const r of rows) {
    const status = r.problems.length ? 'FAIL' : 'ok  ';
    lines.push(`${status} ${r.locale.padEnd(5)} ${r.file.padEnd(9)} ${String(r.length ?? '-').padStart(4)} / ${r.limit}`);
    for (const p of r.problems) lines.push(`       - ${p}`);
  }
  for (const p of problems) lines.push(`FAIL ${p}`);
  const locales = new Set(rows.map((r) => r.locale));
  lines.push(ok ? `check-listing: ${locales.size} locales, ${rows.length} files, all within Play's limits and rules` : 'check-listing: problems found');
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--dir');
  const dir = i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : DEFAULT_LISTING_DIR;
  const result = checkListing(dir);
  console.log(formatReport(result));
  process.exit(result.ok ? 0 : 1);
}
