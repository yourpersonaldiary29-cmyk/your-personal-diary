#!/usr/bin/env node
/**
 * scripts/store/check-listing.mjs - validates the Microsoft Store listing texts in store/listing/.
 *
 *   node scripts/store/check-listing.mjs                     check all 20 language folders (exit code 1 on any problem)
 *   node scripts/store/check-listing.mjs --only en-US,he-IL  check only these folders (missing others are not reported)
 *   node scripts/store/check-listing.mjs --dir <dir>         check another folder with the same layout (the tests)
 *   node scripts/store/check-listing.mjs --json              print the result as JSON
 *
 * Package S1 of docs/store-tasks/STORE-2026-10.md. Modelled on scripts/play/check-listing.mjs (Google Play).
 * `node store/render.mjs --check` runs this checker too.
 *
 * Layout: store/listing/<tag>/ with one UTF-8 file per Partner Center field (FIELDS below), one folder per
 * UI language of the app. The tags are those of the MSIX package's <Resource Language> list
 * (scripts/store/msix-lib.mjs), so that Partner Center pairs each listing with a package language.
 *
 * Sources of the rules (all read 2026-10-27):
 *   [L] "Add and edit Store listing info for MSIX app" (updated 2026-08-24)
 *       https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/add-and-edit-store-listing-info
 *       Description: "This field is required, and will accept up to 10,000 characters of plain text."
 *       What's new: "If this is the first time you're submitting your app, leave this field blank." /
 *         "This field has a 1500 character limit."
 *       Product features: "no more than 200 characters) per feature. You may include up to 20 features." /
 *         "These features will appear bulleted in your Store listing, so don't add your own bullets."
 *       Short description: "keep your short description under 270 characters. The field has a 1000 character limit"
 *       FAQ: "Do not include HTML, code snippets, or URLs in the description field."
 *       "Use proper spelling, grammar, punctuation, and standard capitalization."
 *   [G] "Store listing" (Partner Center, updated 2026-09-09) - the apps page above no longer lists these
 *       fields, the games page does:
 *       https://learn.microsoft.com/en-us/gaming/game-publishing/concepts/store-listing
 *       Keywords: "up to seven search terms with a maximum of 40 characters each, and can use no more than
 *         21 separate words across all search terms."
 *       Copyright and trademark info: "This field has a 200-character limit."
 *   [P] Microsoft Store Policies 7.20 (updated 2026-09-15) https://learn.microsoft.com/en-us/windows/apps/publish/store-policies
 *       10.1: metadata "must accurately and clearly reflect the source, functionality, and features of your product."
 *       10.1.1: "accurately describe the functions, features, user experience and any important limitations";
 *         the title "must not contain marketing or descriptive text, including extraneous use of keywords."
 *       10.1.3: search terms "Not exceed seven unique terms or phrases", "Be relevant", "Not include pricing
 *         terms", "Not use other product titles unless those products are also published by you."
 *       10.2.4: a dependency on a service must be disclosed "at the beginning of the description".
 *   [S] "App package requirements for MSIX app", Supported languages (updated 2026-08-24)
 *       https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements#supported-languages
 *       every tag below is on that list (lower-case there: en-us, he-il, zh-cn, ar-sa, pt-pt, ...).
 *   [H] The project: the brand "Your Personal Diary" is English in every language (owner decision); the Windows
 *       app is a client of the Your Personal Diary server with sync and an automatic offline mode, so no text may
 *       claim that the diary is stored only on the PC or that there is no server/account; the server decrypts a
 *       diary in memory while its owner is signed in and holds the recovery-key escrow (legal/privacy), so no
 *       end-to-end / zero-knowledge claim; no biometric unlock claim; none of the retired local-app features
 *       (remote access over DuckDNS, home-network phone access, local helper process); no store-performance or
 *       price claims and no calls to action (the Play checker's rules, kept for consistency); one real
 *       translation per folder in the language's own script, with the same structure as en-US; the Store build
 *       opens in English (src/i18n/runtime.ts), so a translated description that sends the reader to
 *       Settings > Language also gives those English labels ("(Settings)", "(Language)").
 *       The claim lists cover all 20 languages with the same families; they are patterns, not a parser.
 *
 * Counting: Microsoft does not say how Partner Center counts; this script counts UTF-16 code units (the
 * stricter count) after CRLF -> LF and without the final line break, like the Play checker.
 *
 * Placeholders: only {{PUBLISHER_NAME}} (copyright.txt) and {{CONTACT_EMAIL}} (support-contact.txt). They are
 * filled from store/config.json, else legal/settings.json, else store/config.example.json before the lengths
 * are measured; the rendered copies in store/out/listing/ (values already filled) pass too.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_LISTING_DIR = path.join(ROOT, 'store', 'listing');

export const BRAND = 'Your Personal Diary';

/** The default listing language (owner decision: a customer whose language has no listing sees English). */
export const DEFAULT_TAG = 'en-US';

/**
 * The 20 listing folders: tag (as the MSIX manifest writes it), the app's locale code, the English name and
 * the script(s) a real translation is written in. Order = docs/store-tasks/LANG.md.
 */
export const STORE_LOCALES = {
  'en-US': { app: 'en', name: 'English (United States)', scripts: ['Latin'] },
  'he-IL': { app: 'he', name: 'Hebrew', scripts: ['Hebrew'] },
  'zh-CN': { app: 'zh', name: 'Chinese (Simplified)', scripts: ['Han'] },
  'es-ES': { app: 'es', name: 'Spanish (Spain)', scripts: ['Latin'] },
  'pl-PL': { app: 'pl', name: 'Polish', scripts: ['Latin'] },
  'ru-RU': { app: 'ru', name: 'Russian', scripts: ['Cyrillic'] },
  'fr-FR': { app: 'fr', name: 'French (France)', scripts: ['Latin'] },
  'ar-SA': { app: 'ar', name: 'Arabic', scripts: ['Arabic'] },
  'ja-JP': { app: 'ja', name: 'Japanese', scripts: ['Hiragana', 'Katakana', 'Han'] },
  'tr-TR': { app: 'tr', name: 'Turkish', scripts: ['Latin'] },
  'cs-CZ': { app: 'cs', name: 'Czech', scripts: ['Latin'] },
  'hu-HU': { app: 'hu', name: 'Hungarian', scripts: ['Latin'] },
  'bg-BG': { app: 'bg', name: 'Bulgarian', scripts: ['Cyrillic'] },
  'el-GR': { app: 'el', name: 'Greek', scripts: ['Greek'] },
  'pt-PT': { app: 'pt', name: 'Portuguese (Portugal)', scripts: ['Latin'] },
  'de-DE': { app: 'de', name: 'German', scripts: ['Latin'] },
  'ro-RO': { app: 'ro', name: 'Romanian', scripts: ['Latin'] },
  'it-IT': { app: 'it', name: 'Italian', scripts: ['Latin'] },
  'th-TH': { app: 'th', name: 'Thai', scripts: ['Thai'] },
  'hi-IN': { app: 'hi', name: 'Hindi', scripts: ['Devanagari'] },
};

/**
 * One file per Partner Center field, with its limit and source ([L], [G], [H] in the header).
 *   max          hard limit in characters (UTF-16 code units)
 *   recommended  soft limit: over it is a warning, not a failure
 *   items        list fields: at most this many non-empty lines, each at most perItem characters
 *   words        keywords: at most this many words over all terms
 */
export const FIELDS = {
  'title.txt': { label: 'Product name', exact: BRAND, source: '[H] the reserved name, English in every language' },
  'short-description.txt': { label: 'Short description', max: 1000, recommended: 270, oneLine: true, source: '[L]' },
  'description.txt': { label: 'Description', max: 10000, required: true, source: '[L]' },
  'whats-new.txt': { label: "What's new in this version", max: 1500, source: '[L] (leave it blank on the first submission)' },
  'features.txt': { label: 'Product features', items: 20, perItem: 200, source: '[L]' },
  'keywords.txt': { label: 'Search terms', items: 7, perItem: 40, words: 21, source: '[G] + [P] 10.1.3' },
  'copyright.txt': { label: 'Copyright and trademark info', max: 200, placeholder: 'PUBLISHER_NAME', source: '[G]' },
  'support-contact.txt': { label: 'Support contact info (Properties page)', exactPlaceholder: 'CONTACT_EMAIL', source: '[H] one value, legal/settings.json' },
};
export const FILES = Object.keys(FIELDS);

/** Placeholders a listing text may contain (filled by store/render.mjs and the CSV generator). */
export const PLACEHOLDERS = ['PUBLISHER_NAME', 'CONTACT_EMAIL'];

/** Acronyms that are legitimately written in capitals. */
const ALLOWED_CAPS = new Set(['HTTPS', 'JSON', 'HTML']);

const URL_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|app|io|dev|il|co|info|me|fly)\b/i;
const HTML_RE = /<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?\/?>|&[a-z]+;|&#\d+;/i;
const EMOJI_RE = /\p{Extended_Pictographic}|\u{FE0F}|[\u{1F000}-\u{1FAFF}]|[☀-➿]/u;
const REPEATED_RE = /[!?]{2,}|\.{3,}|…|-{2,}|[*#_~^=%$&|<>]{2,}/;
/** Four or more capital letters in a row (Latin, Greek, Cyrillic): "ALL CAPS" unless allow-listed. */
const CAPS_WORD_RE = /(?<![\p{L}\p{N}])\p{Lu}{4,}(?![\p{L}\p{N}])/gu;
/** A bullet the author typed: Partner Center adds its own to features and keywords. */
const BULLET_RE = /^[-•*·–—▪●]\s*/;

const UNICODE_BOUNDARY = '(?:(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_])|(?<=[\\p{L}\\p{N}_])(?![\\p{L}\\p{N}_]))';
function claimRe(source) {
  return new RegExp(source.replaceAll('\\b', UNICODE_BOUNDARY), 'iu');
}

/**
 * Store-performance, price / promotion claims and calls to action, per language (the Play checker's list,
 * scripts/play/check-listing.mjs). '*' applies to every folder. Price terms are also forbidden in search
 * terms by policy 10.1.3; the price itself is set on the Pricing and availability page (free).
 */
export const FORBIDDEN_CLAIMS = {
  '*': ['#\\s?1\\b', '№\\s?1\\b', 'million downloads'],
  en: ['\\bno\\.?\\s?1\\b', '\\bbest\\b', '\\btop\\b', '\\bpopular\\b', '\\bfree\\b', '\\bdiscount\\b', '\\bsale\\b', "editor'?s choice", '\\baward', '\\bdownload now\\b', '\\binstall now\\b', '\\btry now\\b', '\\bget it now\\b'],
  he: ['הטוב ביותר', 'הכי טוב', 'מספר 1', "מס' 1", 'חינם', 'בחינם', 'הורידו עכשיו', 'התקינו עכשיו'],
  ar: ['الأفضل', 'رقم 1', 'مجاني', 'مجانا', 'مجانًا', 'حمل الآن', 'نزّل الآن'],
  zh: ['最好', '最佳', '第一', '免费', '立即下载', '立即安装'],
  ja: ['最高', '一番', '無料', '今すぐダウンロード', '今すぐインストール'],
  hi: ['सबसे अच्छा', 'सबसे अच्छी', 'नंबर 1', 'मुफ़्त', 'मुफ्त', 'फ़्री', 'अभी डाउनलोड'],
  th: ['ดีที่สุด', 'อันดับ 1', 'อันดับหนึ่ง', 'ฟรี', 'ดาวน์โหลดเลย'],
  es: ['\\bel mejor\\b', '\\bla mejor\\b', '\\bnúmero 1\\b', '\\bgratis\\b', '\\bgratuit[ao]\\b', 'descarga ahora', 'descárgala ahora'],
  pt: ['\\bo melhor\\b', '\\ba melhor\\b', '\\bnúmero 1\\b', '\\bgrátis\\b', '\\bgratuit[ao]\\b', 'transfira agora', 'baixe agora', 'instale agora'],
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
 * "Stored only on your PC / device", "stays on your PC", "no cloud", "no server", "fully offline": untrue for the
 * server-based app. Every language has the same families as en: (1) "only" + the device, in either word order
 * ("only on your PC", "on your PC only", "PCにのみ", "במחשב בלבד"); (2) "stays on / never leaves" the device;
 * (3) "only locally"; (4) no cloud / no server / fully offline. Patterns, not a parser: they catch the usual
 * wordings, not every paraphrase - a human still reads each translation (store/listing/README.md).
 */
export const DEVICE_ONLY_CLAIMS = {
  en: [
    '(?<!not )only on (?:your|this|the) (?:own )?(?:device|phone|computer|pc)\\b',
    '\\bon (?:your|this|the) (?:own )?(?:device|phone|computer|pc) only\\b',
    'stays? (?:only )?(?:on|with|in) (?:your|this|the) (?:own )?(?:device|phone|computer|pc)\\b',
    'never leaves? (?:your|this|the) (?:device|phone|computer|pc)\\b',
    '(?<!not )\\b(?:only|solely|exclusively) (?:stored |kept |saved )?locally\\b',
    '\\blocally only\\b',
    '\\bno cloud\\b',
    'without (?:a|the) cloud',
    '\\bno server\\b',
    'stored only on',
    '(?:fully|completely|entirely) offline',
  ],
  he: [
    '(?<!לא )רק (?:על |ב)ה?(?:מכשיר|טלפון|מחשב)',
    '(?:על |ב)ה?(?:מכשיר|טלפון|מחשב)(?: האישי)?(?: שלכם| שלכן| שלך| הזה)? בלבד',
    'נשאר(?:ת|ים|ות)? (?:רק )?(?:על |ב)ה?(?:מכשיר|טלפון|מחשב)',
    'לא (?:יוצא|יוצאת|עוזב|עוזבת) (?:אף פעם |לעולם )?(?:את |מ)ה(?:מכשיר|טלפון|מחשב)',
    '(?<!לא )(?:רק|אך ורק) (?:באופן )?מקומי',
    'בלי ענן', 'ללא ענן', 'אין שרת', 'בלי שרת', 'ללא שרת', 'לגמרי בלי חיבור',
  ],
  ar: [
    '(?<!ليس )(?:فقط|حصرًا|حصرا) (?:على|في) (?:جهازك|هاتفك|حاسوبك|كمبيوترك|الجهاز|الحاسوب|الكمبيوتر)',
    '(?:على|في) (?:جهازك|هاتفك|حاسوبك|كمبيوترك|الجهاز|الحاسوب|الكمبيوتر)(?: الشخصي)? (?:فقط|وحده|حصرًا|حصرا)',
    '(?:يبقى|تبقى|يظل|تظل) (?:فقط )?(?:على|في) (?:جهازك|هاتفك|حاسوبك|كمبيوترك)',
    'لا (?:يغادر|تغادر) (?:أبدًا |أبدا )?(?:جهازك|هاتفك|حاسوبك|كمبيوترك)',
    '(?:محليًا|محليا) فقط', 'فقط (?:محليًا|محليا)',
    'بدون سحابة', 'دون سحابة', 'لا خادم', 'بدون خادم', 'دون خادم',
  ],
  zh: [
    '(?<![不仅只])(?:仅|只|仅仅|只有)(?:会)?(?:保存|存储|储存|存放|存|留|保留)?(?:在|于)(?:您的|你的|本地|这台|本台)?(?:设备|手机|电脑|计算机|PC)',
    '(?:设备|手机|电脑|计算机|PC)(?:上|中|里|内)?(?:仅此|而已)',
    '(?:留|保留|待)在(?:您的|你的)?(?:设备|手机|电脑|计算机|PC)',
    '不(?:会)?离开(?:您的|你的)?(?:设备|手机|电脑|计算机|PC)',
    '(?<![不仅只])(?:仅|只)(?:在|于)?本地', '仅限本地', '本地(?:仅|只)',
    '无云', '没有云', '没有服务器', '无需服务器', '不需要服务器', '完全离线',
  ],
  ja: [
    '(?:端末|デバイス|スマートフォン|スマホ|PC|パソコン|コンピューター)(?:内|上)?(?:に|で)?(?:のみ|だけ)(?!で(?:なく|は))',
    '(?:端末|デバイス|スマホ|PC|パソコン|コンピューター)(?:内|上)?に(?:とどま|留ま)',
    '(?:端末|デバイス|スマホ|PC|パソコン|コンピューター)から(?:出|離れ|外に出)(?:ません|ない)',
    'ローカル(?:に|で)?(?:のみ|だけ)',
    'クラウドなし', 'クラウドを使わ', 'サーバーなし', 'サーバー不要', '完全オフライン',
  ],
  hi: [
    '(?<!न )(?:केवल|सिर्फ़|सिर्फ|मात्र) (?:आपके |इस |अपने )?(?:डिवाइस|फ़ोन|फोन|कंप्यूटर|पीसी)',
    '(?:डिवाइस|फ़ोन|फोन|कंप्यूटर|पीसी) (?:पर|में) ही (?:रह|सहेज|सुरक्षित रह|स्टोर)',
    '(?:डिवाइस|फ़ोन|फोन|कंप्यूटर|पीसी) (?:से )?(?:कभी )?(?:बाहर )?नहीं (?:जाता|जाती|निकलता|निकलती)',
    '(?:केवल|सिर्फ़|सिर्फ) स्थानीय',
    'क्लाउड नहीं', 'बिना क्लाउड', 'कोई सर्वर नहीं', 'बिना सर्वर', 'सर्वर के बिना',
  ],
  th: [
    'เฉพาะ(?:บน|ใน)(?:อุปกรณ์|โทรศัพท์|เครื่อง|คอมพิวเตอร์|พีซี)',
    '(?:บน|ใน)?(?:อุปกรณ์|โทรศัพท์|เครื่อง|คอมพิวเตอร์|พีซี)(?:ของคุณ)?เท่านั้น',
    'อยู่(?:แต่)?(?:บน|ใน)(?:อุปกรณ์|โทรศัพท์|เครื่อง|คอมพิวเตอร์|พีซี)(?:ของคุณ)?(?:เท่านั้น|ตลอด)',
    'ไม่(?:เคย)?ออกจาก(?:อุปกรณ์|โทรศัพท์|เครื่อง|คอมพิวเตอร์|พีซี)',
    'เฉพาะในเครื่อง', 'ไม่มีคลาวด์', 'ไม่ใช้คลาวด์', 'ไม่มีเซิร์ฟเวอร์', 'ไม่ใช้เซิร์ฟเวอร์',
  ],
  es: [
    '(?<!no )(?:solo|sólo|únicamente|solamente|exclusivamente) en (?:tu|su|este|el) (?:propio )?(?:dispositivo|teléfono|móvil|ordenador|equipo|pc)',
    'en (?:tu|su|este|el) (?:propio )?(?:dispositivo|teléfono|móvil|ordenador|equipo|pc) (?:solamente|únicamente|nada más)',
    'se queda (?:solo |sólo |únicamente )?en (?:tu|su|este|el) (?:dispositivo|teléfono|móvil|ordenador|equipo|pc)',
    'nunca sale de (?:tu|su|este|el) (?:dispositivo|teléfono|móvil|ordenador|equipo|pc)',
    '(?<!no )(?:solo|sólo|únicamente) (?:en )?local','sin nube', 'sin servidor', 'totalmente sin conexión',
  ],
  pt: [
    '(?<!não )(?:apenas|somente|só|unicamente|exclusivamente) no (?:seu|teu|este|próprio) (?:próprio )?(?:dispositivo|telefone|telemóvel|computador|pc)',
    'no (?:seu|teu|este) (?:próprio )?(?:dispositivo|telefone|telemóvel|computador|pc) (?:apenas|somente|e em mais nenhum)',
    'fica (?:apenas |só |somente )?no (?:seu|teu|este) (?:dispositivo|telefone|telemóvel|computador|pc)',
    'nunca sai do (?:seu|teu|este) (?:dispositivo|telefone|telemóvel|computador|pc)',
    '(?<!não )(?:apenas|somente|só) localmente', 'sem nuvem', 'sem servidor', 'totalmente offline',
  ],
  fr: [
    "(?<!(?:pas|non) )(?:uniquement|seulement|exclusivement) (?:sur|dans) (?:votre|ton|cet?|l['’]) ?(?:appareil|téléphone|ordinateur|pc)",
    "\\bque sur (?:votre|ton|cet?|l['’]) ?(?:appareil|téléphone|ordinateur|pc)",
    "reste (?:uniquement |seulement )?sur (?:votre|ton|cet?|l['’]) ?(?:appareil|téléphone|ordinateur|pc)",
    "ne quitte jamais (?:votre|ton|cet?|l['’]) ?(?:appareil|téléphone|ordinateur|pc)",
    '(?<!(?:pas|non) )(?:uniquement|seulement) en local', 'sans cloud', 'sans nuage', 'sans serveur', 'entièrement hors ligne',
  ],
  it: [
    '(?<!non )(?:solo|soltanto|unicamente|esclusivamente) (?:sul|nel) (?:tuo|suo|proprio|questo) (?:dispositivo|telefono|computer|pc)',
    '(?:sul|nel) (?:tuo|suo|proprio|questo) (?:dispositivo|telefono|computer|pc) e basta',
    'resta (?:solo |soltanto )?(?:sul|nel) (?:tuo|suo|proprio|questo) (?:dispositivo|telefono|computer|pc)',
    'non lascia mai il (?:tuo|suo|proprio|questo) (?:dispositivo|telefono|computer|pc)',
    '(?<!non )(?:solo|soltanto) (?:in locale|localmente)', 'senza cloud', 'senza server', 'completamente offline',
  ],
  de: [
    '(?<!nicht )(?:nur|ausschließlich) (?:auf|in) (?:deinem|ihrem|diesem|dem|einem) (?:eigenen )?(?:gerät|handy|smartphone|telefon|computer|rechner|pc)',
    'bleibt (?:nur |ausschließlich )?(?:auf|bei|in) (?:deinem|ihrem|diesem|dem) (?:eigenen )?(?:gerät|handy|smartphone|telefon|computer|rechner|pc)',
    'verlässt (?:dein|ihr|das|diesen?) (?:gerät|handy|smartphone|computer|rechner|pc) nie',
    '(?<!nicht )(?:nur|ausschließlich) lokal', 'ohne cloud', 'ohne server', 'komplett offline', 'vollständig offline',
  ],
  ro: [
    '(?<!nu )(?:doar|numai|exclusiv) (?:pe|în) (?:dispozitivul|telefonul|calculatorul|computerul|pc-ul)',
    '(?:pe|în) (?:dispozitivul|telefonul|calculatorul|computerul|pc-ul) (?:tău|dumneavoastră|acesta) (?:și atât|doar)',
    'rămâne (?:doar |numai )?(?:pe|în) (?:dispozitivul|telefonul|calculatorul|computerul|pc-ul)',
    'nu părăsește niciodată (?:dispozitivul|telefonul|calculatorul|computerul|pc-ul)',
    '(?<!nu )(?:doar|numai) local', 'fără cloud', 'fără server', 'complet offline',
  ],
  el: [
    '(?<!όχι )μόνο (?:στη|στο|στον|σε) (?:συσκευή|τηλέφωνο|τηλέφωνό|κινητό|υπολογιστή|pc)',
    '(?:στη|στο|στον) (?:συσκευή|τηλέφωνο|τηλέφωνό|κινητό|υπολογιστή|pc)(?: σου| σας)? μόνο',
    '(?:μένει|παραμένει) (?:μόνο )?(?:στη|στο|στον) (?:συσκευή|τηλέφωνο|τηλέφωνό|κινητό|υπολογιστή|pc)',
    'δεν φεύγει ποτέ από', '(?<!όχι )μόνο τοπικά', 'χωρίς cloud', 'χωρίς νέφος', 'χωρίς διακομιστή', 'εντελώς εκτός σύνδεσης',
  ],
  pl: [
    '(?<!nie )(?:tylko|wyłącznie|jedynie) (?:na|w) (?:twoim|tym|swoim|twym) (?:własnym )?(?:urządzeniu|telefonie|komputerze|pc)',
    '(?:zostaje|pozostaje) (?:tylko |wyłącznie )?(?:na|w) (?:twoim|tym|swoim) (?:urządzeniu|telefonie|komputerze|pc)',
    'nigdy nie opuszcza (?:twojego|tego|swojego) (?:urządzenia|telefonu|komputera|pc)',
    '(?<!nie )(?:tylko|wyłącznie|jedynie) lokalnie', 'bez chmury', 'bez serwera', 'całkowicie offline',
  ],
  cs: [
    '(?:jen|pouze|výhradně) (?:na|ve?) (?:tvém|vašem|tomto|svém) (?:zařízení|telefonu|počítači|pc)',
    '(?:zůstává|zůstane) (?:jen |pouze )?(?:na|ve?) (?:tvém|vašem|tomto|svém) (?:zařízení|telefonu|počítači|pc)',
    'nikdy neopouští (?:tvé|vaše|toto|tvůj|váš|svůj) (?:zařízení|telefon|počítač|pc)',
    '(?:jen|pouze) lokálně', 'bez cloudu', 'bez serveru', 'zcela offline',
  ],
  hu: [
    '(?<!nem )(?:csak|kizárólag) (?:a|ezen a|a saját) (?:készülék|telefon|eszköz|számítógép|gép|pc)',
    '(?<!nem )(?:csak|kizárólag) (?:a )?(?:gépeden|gépén|számítógépeden|számítógépén|készülékeden|telefonodon|eszközödön)',
    '(?:gépeden|számítógépeden|készülékeden|telefonodon|eszközödön) marad',
    'soha nem hagyja el a (?:készülék|telefon|eszköz|számítógép|gép)',
    '(?<!nem )(?:csak|kizárólag) helyben', 'felhő nélkül', 'szerver nélkül', 'teljesen offline',
  ],
  ru: [
    '(?<!не )(?:только|лишь|исключительно) (?:на|в) (?:вашем|твоём|твоем|этом|своём|своем) (?:устройстве|телефоне|компьютере|пк)',
    '(?:на|в) (?:вашем|твоём|твоем|этом|своём|своем) (?:устройстве|телефоне|компьютере|пк) и (?:нигде больше|больше нигде)',
    'оста[её]тся (?:только |лишь )?(?:на|в) (?:вашем|твоём|твоем|этом|своём|своем) (?:устройстве|телефоне|компьютере|пк)',
    'никогда не покидает (?:ваше|твоё|твое|это|ваш|твой|этот|свой) (?:устройство|телефон|компьютер|пк)',
    '(?<!не )(?:только|лишь) локально', 'без облака', 'без сервера', 'полностью офлайн',
  ],
  bg: [
    '(?<!не )(?:само|единствено) (?:на|в) (?:вашето|твоето|това|вашия|твоя|този|своето|своя) (?:устройство|телефон|компютър)',
    'остава (?:само )?(?:на|в) (?:вашето|твоето|това|вашия|твоя|този|своето|своя) (?:устройство|телефон|компютър)',
    'никога не напуска (?:вашето|твоето|това|вашия|твоя|този) (?:устройство|телефон|компютър)',
    '(?<!не )само локално', 'без облак', 'без сървър', 'изцяло офлайн',
  ],
  tr: [
    '(?:yalnızca|sadece) (?:bu |kendi )?(?:cihaz|telefon|bilgisayar|pc)\\p{L}*(?:da|de|ta|te)\\b(?! değil)',
    '(?:cihaz|telefon|bilgisayar)\\p{L}*(?:da|de|ta|te) kalır',
    '(?:cihaz|telefon|bilgisayar)\\p{L}*(?:dan|den|tan|ten) (?:asla|hiç|hiçbir zaman) (?:çıkmaz|ayrılmaz)',
    '(?:yalnızca|sadece) yerel', 'bulut yok', 'bulutsuz', 'sunucu yok', 'sunucusuz', 'tamamen çevrimdışı',
  ],
};

/** End-to-end / zero-knowledge / "only you can read it": untrue (the server decrypts while signed in). */
export const OVERCLAIMS = {
  '*': ['end[- ]to[- ]end', '\\be2ee?\\b', 'zero[- ]knowledge'],
  en: ['only you can (?:read|see|open)', 'nobody (?:else )?can (?:read|see|open)', 'not even (?:we|us)\\b'],
  he: ['מקצה לקצה', 'רק אתם יכולים לקרוא', 'רק את(?:ה)? יכול(?:ה)? לקרוא', 'אפילו לא אנחנו'],
  ar: ['من طرف إلى طرف', 'بين الطرفين', 'وحدك من يستطيع'],
  zh: ['端到端', '零知识', '只有您能', '只有你能', '连我们也'],
  ja: ['エンドツーエンド', 'ゼロ知識', 'あなただけが', '私たちでさえ'],
  hi: ['एंड-टू-एंड', 'एंड टू एंड', 'केवल आप ही पढ़', 'हम भी नहीं'],
  th: ['ต้นทางถึงปลายทาง', 'มีแต่คุณเท่านั้นที่', 'แม้แต่เราก็'],
  es: ['de extremo a extremo', 'solo tú puedes', 'ni siquiera nosotros'],
  pt: ['de ponta a ponta', 'só você pode', 'só tu podes', 'nem mesmo nós', 'nem nós'],
  fr: ['de bout en bout', 'vous seul pouvez', 'même pas nous', 'pas même nous'],
  it: ['solo tu puoi', 'nemmeno noi', 'neanche noi'],
  de: ['ende-zu-ende', 'nur du kannst', 'nur sie können', 'nicht einmal wir', 'selbst wir nicht'],
  ro: ['cap-coadă', 'cap la cap', 'doar tu poți', 'nici măcar noi'],
  el: ['από άκρο σε άκρο', 'μόνο εσύ μπορείς', 'ούτε καν εμείς'],
  pl: ['od końca do końca', 'tylko ty możesz', 'nawet my nie'],
  cs: ['koncov(?:é|ým) šifrován', 'jen ty můžeš', 'ani my ne'],
  hu: ['végponttól végpontig', 'csak te olvashatod', 'még mi sem'],
  ru: ['сквозн(?:ое|ым) шифрован', 'только вы можете', 'даже мы не'],
  bg: ['от край до край', 'само вие можете', 'дори ние не'],
  tr: ['uçtan uca', 'yalnızca siz okuyabilirsiniz', 'biz bile'],
};

/** Biometric unlock (Windows Hello, fingerprint, face): the listing makes no such claim (brief S1). */
export const BIOMETRIC_CLAIMS = {
  '*': ['windows hello', '\\bface ?id\\b', '\\btouch ?id\\b'],
  en: ['fingerprint', 'biometric', 'face (?:recognition|unlock)', 'facial recognition'],
  he: ['טביעת אצבע', 'טביעות אצבע', 'זיהוי פנים', 'ביומטר'],
  ar: ['بصمة', 'التعرف على الوجه', 'بيومتري', 'حيوي'],
  zh: ['指纹', '人脸识别', '面部识别', '生物识别'],
  ja: ['指紋', '顔認証', '生体認証'],
  hi: ['फ़िंगरप्रिंट', 'फिंगरप्रिंट', 'चेहरा पहचान', 'चेहरे की पहचान', 'बायोमेट्रिक'],
  th: ['ลายนิ้วมือ', 'จดจำใบหน้า', 'สแกนใบหน้า', 'ไบโอเมตริก'],
  es: ['huella', 'reconocimiento facial', 'biométric'],
  pt: ['impressão digital', 'reconhecimento facial', 'biométric'],
  fr: ['empreinte', 'reconnaissance faciale', 'biométri'],
  it: ['impronta', 'riconoscimento facciale', 'biometric'],
  de: ['fingerabdruck', 'gesichtserkennung', 'biometri'],
  ro: ['amprent', 'recunoaștere facială', 'biometric'],
  el: ['δακτυλικ', 'αναγνώριση προσώπου', 'βιομετρ'],
  pl: ['odcisk', 'rozpoznawanie twarzy', 'biometr'],
  cs: ['otisk', 'rozpoznání obličeje', 'biometri'],
  hu: ['ujjlenyomat', 'arcfelismerés', 'biometri'],
  ru: ['отпечат', 'распознавание лица', 'биометри'],
  bg: ['пръстов отпечатък', 'разпознаване на лице', 'биометри'],
  tr: ['parmak izi', 'yüz tanıma', 'biyometrik'],
};

/**
 * Features of the retired local-only app (store/listing of 2026-10-02) that no longer exist: remote access,
 * the phone on the home network / home Wi-Fi, the local helper process, "no account needed". Every language has
 * the same families as en (the Windows app needs an account on the server).
 */
export const OBSOLETE_CLAIMS = {
  '*': ['duckdns', "let'?s encrypt", 'diary-server', '\\bupnp\\b', '127\\.0\\.0\\.1', '\\bsmtp\\b', '\\blan\\b'],
  en: ['remote access', 'home (?:wi-?fi|network)', 'local helper', 'no online account', 'without an? (?:online )?account', 'no account (?:needed|required)', 'no sign-?up'],
  he: ['גישה מרחוק', 'רשת (?:ה)?ביתית', 'ברשת של הבית', 'וויי-?פיי (?:ה)?ביתי', 'תהליך עזר', 'בלי חשבון', 'ללא חשבון', 'בלי הרשמה', 'ללא הרשמה', 'לא צריך חשבון'],
  ar: ['الوصول عن (?:بعد|بُعد)', 'الدخول عن (?:بعد|بُعد)', '(?:الشبكة|شبكة) (?:المنزلية|المنزل)', 'واي فاي المنزل', 'بدون حساب', 'دون حساب', 'بلا حساب', 'بدون تسجيل', 'دون تسجيل', 'لا حاجة إلى حساب'],
  zh: ['远程访问', '远程连接', '远程存取', '家庭网络', '家中网络', '家里的网络', '家庭 ?wi-?fi', '家中 ?wi-?fi', '本地辅助', '无需(?:注册|账户|帐户|账号)', '不需要(?:注册|账户|帐户|账号)', '不用(?:注册|账户|帐户|账号)'],
  ja: ['リモートアクセス', '遠隔(?:アクセス|操作)', 'ホームネットワーク', '家庭内?(?:ネットワーク|LAN|Wi-?Fi)', '自宅の(?:ネットワーク|LAN|Wi-?Fi)', 'ヘルパープロセス', 'アカウント(?:は|が)?(?:不要|なし|いりません)', '登録(?:は)?不要'],
  hi: ['रिमोट (?:एक्सेस|ऐक्सेस)', 'दूरस्थ (?:पहुँच|पहुंच|एक्सेस)', 'होम नेटवर्क', 'घरेलू नेटवर्क', 'घर के (?:नेटवर्क|वाई-?फ़ाई|वाई-?फाई)', 'घर का (?:नेटवर्क|वाई-?फ़ाई|वाई-?फाई)', 'बिना खाते', 'खाते के बिना', 'कोई खाता नहीं', 'खाते की ज़रूरत नहीं', 'खाते की जरूरत नहीं'],
  th: ['การเข้าถึงระยะไกล', 'เข้าถึงจากระยะไกล', 'เข้าถึงระยะไกล', 'เครือข่ายในบ้าน', 'เครือข่ายภายในบ้าน', 'ไวไฟในบ้าน', 'wi-?fi ในบ้าน', 'ไม่ต้องมีบัญชี', 'ไม่ต้องใช้บัญชี', 'ไม่ต้องสมัคร'],
  es: ['acceso remoto', 'red (?:doméstica|de casa|de tu casa)', 'wi-?fi de (?:tu )?casa', 'sin (?:una )?cuenta', 'sin registro', 'sin registrarte', 'no necesitas (?:una )?cuenta'],
  pt: ['acesso remoto', 'rede (?:doméstica|de casa|da sua casa|da tua casa)', 'wi-?fi de casa', 'sem (?:uma )?conta', 'sem registo', 'sem registro', 'não precisa de (?:uma )?conta'],
  fr: ['accès (?:à|a) distance', 'réseau (?:domestique|de la maison|de votre maison)', 'wi-?fi de (?:la|votre) maison', 'sans compte', 'sans inscription', "pas besoin d['’]un compte"],
  it: ['accesso remoto', 'accesso da remoto', 'rete (?:domestica|di casa)', 'wi-?fi di casa', 'senza (?:un )?account', 'senza registrazione', 'nessun account'],
  de: ['fernzugriff', 'zugriff aus der ferne', 'heimnetz', 'wlan zu hause', 'häuslichen netz', 'hilfsprozess', 'ohne (?:ein )?konto', 'ohne registrierung', 'kein konto (?:nötig|erforderlich)'],
  ro: ['acces (?:de la|la) distanță', 'rețea(?:ua)? (?:de acasă|domestică)', 'wi-?fi(?:-ul)? de acasă', 'fără (?:un )?cont', 'fără înregistrare', 'nu (?:ai nevoie|este nevoie) de (?:un )?cont'],
  el: ['απομακρυσμένη πρόσβαση', 'πρόσβαση από απόσταση', 'οικιακό δίκτυο', 'δίκτυο του σπιτιού', 'wi-?fi του σπιτιού', 'χωρίς λογαριασμό', 'χωρίς εγγραφή'],
  pl: ['zdalny dostęp', 'dostęp zdalny', 'zdalnego dostępu', 'sie(?:ć|ci) domow', 'domow(?:ej|ą|a) sie', 'wi-?fi w domu', 'bez konta', 'bez rejestracji'],
  cs: ['vzdálen\\p{L}* přístup', 'přístup na dálku', 'domácí sít', 'domácí wi-?fi', 'bez účtu', 'bez registrace'],
  hu: ['távoli hozzáférés', 'távoli elérés', 'otthoni (?:hálózat|wi-?fi)', 'fiók nélkül', 'regisztráció nélkül', 'nem kell fiók'],
  ru: ['удал[её]нн\\p{L}* доступ', 'доступ издалека', 'домашн\\p{L}* сет', 'домашн\\p{L}* wi-?fi', 'без (?:учётной|учетной) записи', 'без аккаунта', 'без регистрации'],
  bg: ['отдалечен\\p{L}* достъп', 'достъп от разстояние', 'домашн\\p{L}* мрежа', 'домашн\\p{L}* wi-?fi', 'без акаунт', 'без регистрация', 'без профил'],
  tr: ['uzaktan erişim', '\\bev ağ', 'evdeki ağ', 'ev wi-?fi', 'hesap (?:olmadan|gerekmez|gerektirmez|açmadan)', 'hesapsız', 'kayıt (?:olmadan|gerekmez|olmaksızın)'],
};

/** How often one content word (five letters or more) may occur in the description - a stuffing guard. */
const MAX_WORD_REPEATS = 15;

// ---------------------------------------------------------------------------------------------
export function normalise(raw) {
  return raw.replace(/\r\n/g, '\n').replace(/\n$/, '');
}

/** The length counted against a limit (UTF-16 code units of the normalised text). */
export function storeLength(text) {
  return normalise(text).length;
}

/** The non-empty lines of a list field (features, keywords), trimmed. */
export function itemsOf(text) {
  return normalise(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Publisher name and contact e-mail: store/config.json -> legal/settings.json -> store/config.example.json. */
export function loadValues(root = ROOT) {
  const candidates = [path.join(root, 'store', 'config.json'), path.join(root, 'legal', 'settings.json'), path.join(root, 'store', 'config.example.json')];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      const publisherName = String(raw.publisherName ?? '').trim();
      const contactEmail = String(raw.contactEmail ?? '').trim();
      if (publisherName && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return { publisherName, contactEmail, source: path.relative(root, file).replace(/\\/g, '/') };
      }
    } catch {
      // try the next file
    }
  }
  return { publisherName: 'Publisher Name', contactEmail: 'support@example.com', source: '(none found - sample values)' };
}

export function fillPlaceholders(text, values) {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) => {
    if (key === 'PUBLISHER_NAME') return values.publisherName;
    if (key === 'CONTACT_EMAIL') return values.contactEmail;
    return whole;
  });
}

function scriptShare(text, scripts) {
  const letters = [...text.replaceAll(BRAND, '')].filter((ch) => /\p{L}/u.test(ch));
  if (!letters.length) return 0;
  const inScript = letters.filter((ch) => scripts.some((s) => new RegExp(`\\p{Script=${s}}`, 'u').test(ch))).length;
  return inScript / letters.length;
}

/** Blocks separated by an empty line, and the "- " lines: the structure translations must keep. */
export function shapeOf(text) {
  const t = normalise(text);
  return { paragraphs: t.split(/\n\n+/).filter((p) => p.trim()).length, bullets: (t.match(/^- /gm) ?? []).length };
}

function claimHits(lists, app, text) {
  const hits = [];
  for (const source of [...(lists['*'] ?? []), ...(lists[app] ?? [])]) {
    const m = claimRe(source).exec(text);
    if (m) hits.push(m[0]);
  }
  return hits;
}

/**
 * The problems and warnings of one field file. `english` is the en-US text of the same file (null for en-US),
 * used for the translation and structure checks.
 */
export function textProblems(locale, file, raw, english = null, values = loadValues()) {
  const problems = [];
  const warnings = [];
  const def = STORE_LOCALES[locale];
  const field = FIELDS[file];
  if (!def) return { problems: [`${locale}: not a listing language of the app`], warnings, length: null };
  if (!field) return { problems: [`${file}: not a listing field`], warnings, length: null };

  if (raw.charCodeAt(0) === 0xfeff) problems.push('starts with a byte-order mark');
  if (!raw.endsWith('\n')) problems.push('does not end with a line break');
  if (/\n\n$/.test(raw.replace(/\r\n/g, '\n'))) problems.push('ends with an empty line');
  const source = normalise(raw);
  if (!source.trim()) problems.push('is empty');
  if (/\t/.test(source)) problems.push('contains a tab');
  if (/[  ]$/m.test(source)) problems.push('has a space at the end of a line');
  if (/^[  ]/m.test(source)) problems.push('has a space at the start of a line');
  if (/ {2}/.test(source)) problems.push('has two spaces in a row');
  if (/\n{3}/.test(source)) problems.push('has two empty lines in a row');
  if (/^\n/.test(source)) problems.push('starts with an empty line');

  // Placeholders: only the two known ones, each only in its own file.
  for (const [, key] of source.matchAll(/\{\{([A-Za-z_]+)\}\}/g)) {
    if (!PLACEHOLDERS.includes(key)) problems.push(`unknown placeholder {{${key}}}`);
    else if ((key === 'PUBLISHER_NAME' && file !== 'copyright.txt') || (key === 'CONTACT_EMAIL' && file !== 'support-contact.txt')) {
      problems.push(`placeholder {{${key}}} belongs only in ${key === 'PUBLISHER_NAME' ? 'copyright.txt' : 'support-contact.txt'}`);
    }
  }
  if (/\{\{|\}\}/.test(source.replace(/\{\{[A-Za-z_]+\}\}/g, ''))) problems.push('has a broken placeholder (unpaired {{ or }})');

  const text = fillPlaceholders(source, values);
  const length = text.length;

  if (field.exact !== undefined && text !== field.exact) problems.push(`must be exactly "${field.exact}" (it is ${JSON.stringify(text)})`);
  if (field.exactPlaceholder) {
    if (source !== `{{${field.exactPlaceholder}}}` && text !== values.contactEmail) {
      problems.push(`must be exactly {{${field.exactPlaceholder}}} (filled from ${values.source}) - the same contact in every language`);
    }
  }
  if (field.placeholder && !source.includes(`{{${field.placeholder}}}`) && !text.includes(values.publisherName)) {
    problems.push(`must name the publisher through {{${field.placeholder}}}`);
  }
  if (file === 'copyright.txt' && !/©/.test(text)) problems.push('must start the notice with ©');
  if (field.max !== undefined && length > field.max) problems.push(`is ${length} characters long, the limit is ${field.max}`);
  if (field.recommended !== undefined && length > field.recommended) {
    warnings.push(`is ${length} characters long; Microsoft shows only the first ${field.recommended} in some views - shorten it if you can`);
  }
  if (field.oneLine && text.includes('\n')) problems.push('must be one paragraph without line breaks');

  if (field.items) {
    const items = itemsOf(text);
    if (/\n\n/.test(text)) problems.push('has an empty line between items');
    if (items.length > field.items) problems.push(`has ${items.length} items, the limit is ${field.items}`);
    items.forEach((item, i) => {
      if (item.length > field.perItem) problems.push(`item ${i + 1} is ${item.length} characters long, the limit is ${field.perItem}`);
      if (BULLET_RE.test(item)) problems.push(`item ${i + 1} starts with a bullet - Partner Center adds its own`);
    });
    if (field.words) {
      const words = items.join(' ').split(/\s+/).filter(Boolean).length;
      if (words > field.words) problems.push(`uses ${words} words over all terms, the limit is ${field.words}`);
      const seen = new Set();
      for (const item of items) {
        const key = item.toLocaleLowerCase(def.app);
        if (seen.has(key)) problems.push(`repeats the search term "${item}" (terms must be unique)`);
        seen.add(key);
        if (item.includes(BRAND) || /your personal diary/i.test(item)) problems.push(`search term "${item}" repeats the product name`);
      }
    }
  }

  if (file !== 'support-contact.txt' && file !== 'copyright.txt') {
    const url = URL_RE.exec(text);
    if (url) problems.push(`contains a web address (${url[0]}) - links have their own fields`);
  }
  const html = HTML_RE.exec(text);
  if (html) problems.push(`contains HTML (${html[0]}) - the fields take plain text`);
  // ©, ® and ™ are Extended_Pictographic in Unicode but are the legal signs the copyright field needs.
  const emoji = EMOJI_RE.exec(text.replace(/[©®™]/g, ''));
  if (emoji) problems.push(`contains an emoji or pictograph (${JSON.stringify(emoji[0])})`);
  const repeated = REPEATED_RE.exec(text);
  if (repeated) problems.push(`repeats punctuation (${JSON.stringify(repeated[0])})`);
  for (const [word] of text.matchAll(CAPS_WORD_RE)) {
    if (!ALLOWED_CAPS.has(word) && !BRAND.includes(word)) problems.push(`has a word in ALL CAPS (${word})`);
  }

  const withoutBrand = text.replaceAll(BRAND, '');
  for (const hit of claimHits(FORBIDDEN_CLAIMS, def.app, withoutBrand)) {
    problems.push(`makes a store-performance, price or call-to-action claim (${JSON.stringify(hit)})`);
  }
  for (const hit of claimHits(DEVICE_ONLY_CLAIMS, def.app, text)) {
    problems.push(`claims the diary stays only on the PC / that there is no server (${JSON.stringify(hit)}) - the app is a client of the Your Personal Diary server`);
  }
  for (const hit of claimHits(OVERCLAIMS, def.app, text)) {
    problems.push(`claims end-to-end / zero-knowledge encryption (${JSON.stringify(hit)}) - the server decrypts the diary while you are signed in`);
  }
  for (const hit of claimHits(BIOMETRIC_CLAIMS, def.app, text)) {
    problems.push(`claims biometric unlock (${JSON.stringify(hit)}) - the listing makes no such claim`);
  }
  for (const hit of claimHits(OBSOLETE_CLAIMS, def.app, text)) {
    problems.push(`describes a feature of the retired local-only app (${JSON.stringify(hit)})`);
  }

  if (file === 'description.txt') {
    if (!text.startsWith(BRAND) && !normalise(text).split('\n')[0].includes(BRAND)) {
      problems.push(`the first paragraph must name the app ("${BRAND}") and disclose that it needs an account on its server (policy 10.2.4)`);
    }
    const counts = new Map();
    for (const [word] of withoutBrand.toLowerCase().matchAll(/[\p{L}\p{M}]{5,}/gu)) counts.set(word, (counts.get(word) ?? 0) + 1);
    for (const [word, n] of counts) if (n > MAX_WORD_REPEATS) problems.push(`repeats the word "${word}" ${n} times (keyword stuffing?)`);
  }

  const translated = !['title.txt', 'support-contact.txt', 'copyright.txt'].includes(file);
  if (translated && locale !== DEFAULT_TAG) {
    const share = scriptShare(text, def.scripts);
    if (share < 0.6) problems.push(`is not written in ${def.scripts.join(' / ')} (${Math.round(share * 100)}% of its letters are)`);
    if (english !== null && normalise(english) === source) problems.push('is the English text, not a translation');
  }
  if (english !== null && ['description.txt', 'whats-new.txt'].includes(file)) {
    const mine = shapeOf(source);
    const theirs = shapeOf(english);
    if (mine.paragraphs !== theirs.paragraphs || mine.bullets !== theirs.bullets) {
      problems.push(`structure differs from en-US: ${mine.paragraphs} paragraphs / ${mine.bullets} "- " lines here, ${theirs.paragraphs} / ${theirs.bullets} in en-US (translate block by block)`);
    }
  }
  if (english !== null && file === 'features.txt') {
    const mine = itemsOf(source).length;
    const theirs = itemsOf(english).length;
    if (mine !== theirs) problems.push(`has ${mine} features, en-US has ${theirs} (translate line by line)`);
  }
  // The Store build opens in English (src/i18n/runtime.ts): where en-US sends the reader to Settings > Language,
  // a translation must also give those two English labels, which are what the reader sees at that moment.
  if (english !== null && file === 'description.txt' && /\bSettings, under Language\b/.test(normalise(english))) {
    const missing = UI_LABELS_SEEN_IN_ENGLISH.filter((label) => !new RegExp(`[(（]${label}[)）]`).test(text));
    if (missing.length) {
      problems.push(`must give the English label${missing.length > 1 ? 's' : ''} ${missing.map((l) => `"(${l})"`).join(' and ')} after the translated ones - the app opens in English`);
    }
  }
  return { problems, warnings, length };
}

/** The English labels a reader of any listing sees on the first launch (the Store build opens in English). */
export const UI_LABELS_SEEN_IN_ENGLISH = ['Settings', 'Language'];

/**
 * The claim rules alone (store performance / price, device-only, end-to-end, biometric, retired features),
 * for texts that are not field files - the screenshot captions the CSV generator carries along.
 */
export function claimProblems(locale, text) {
  const def = STORE_LOCALES[locale];
  if (!def) return [`${locale}: not a listing language of the app`];
  const out = [];
  const lists = [
    [FORBIDDEN_CLAIMS, 'store-performance, price or call-to-action claim', text.replaceAll(BRAND, '')],
    [DEVICE_ONLY_CLAIMS, '"only on the PC / no server" claim', text],
    [OVERCLAIMS, 'end-to-end / zero-knowledge claim', text],
    [BIOMETRIC_CLAIMS, 'biometric unlock claim', text],
    [OBSOLETE_CLAIMS, 'retired local-only feature', text],
  ];
  for (const [list, what, subject] of lists) for (const hit of claimHits(list, def.app, subject)) out.push(`${what} (${JSON.stringify(hit)})`);
  return out;
}

function limitLabel(field) {
  if (field.exact !== undefined) return 'exact';
  if (field.exactPlaceholder) return 'exact';
  if (field.items) return `${field.items} x ${field.perItem}${field.words ? `, ${field.words} words` : ''}`;
  return `${field.max}${field.recommended ? ` (best <= ${field.recommended})` : ''}`;
}

/**
 * Checks a listing folder. `only` limits the check to those tags (missing other folders are then not
 * reported). Returns rows (one per tag and file), folder-level problems, warnings and `ok`.
 */
export function checkListing(dir = DEFAULT_LISTING_DIR, { only = null, values = loadValues() } = {}) {
  const rows = [];
  const problems = [];
  if (!existsSync(dir)) return { rows, problems: [`${dir} does not exist`], ok: false, values };
  const present = readdirSync(dir).filter((name) => statSync(path.join(dir, name)).isDirectory() && !name.startsWith('_'));
  const expected = Object.keys(STORE_LOCALES).filter((tag) => !only || only.includes(tag));
  if (only) for (const tag of only) if (!STORE_LOCALES[tag]) problems.push(`--only: ${tag} is not a listing language of the app`);
  for (const tag of expected) if (!present.includes(tag)) problems.push(`language folder missing: ${tag} (${STORE_LOCALES[tag].name})`);
  for (const name of present) if (!STORE_LOCALES[name]) problems.push(`unexpected folder: ${name} (not one of the 20 listing tags)`);

  const english = {};
  for (const file of FILES) {
    const p = path.join(dir, DEFAULT_TAG, file);
    english[file] = existsSync(p) ? readFileSync(p, 'utf8') : null;
  }
  for (const tag of expected) {
    if (!present.includes(tag)) continue;
    for (const file of FILES) {
      const field = FIELDS[file];
      const p = path.join(dir, tag, file);
      if (!existsSync(p)) {
        rows.push({ locale: tag, file, length: null, limit: limitLabel(field), problems: ['missing'], warnings: [] });
        continue;
      }
      const raw = readFileSync(p, 'utf8');
      const result = textProblems(tag, file, raw, tag === DEFAULT_TAG ? null : english[file], values);
      let length = result.length;
      if (field.items) {
        const items = itemsOf(fillPlaceholders(normalise(raw), values));
        length = `${items.length} items, longest ${Math.max(0, ...items.map((i) => i.length))}`;
      }
      rows.push({ locale: tag, file, length, limit: limitLabel(field), problems: result.problems, warnings: result.warnings });
    }
    const extra = readdirSync(path.join(dir, tag)).filter((name) => !FILES.includes(name));
    if (extra.length) problems.push(`${tag}: unexpected file(s): ${extra.join(', ')}`);
  }
  const ok = problems.length === 0 && rows.every((r) => r.problems.length === 0);
  return { rows, problems, ok, values };
}

export function formatReport({ rows, problems, ok, values }) {
  const lines = [];
  for (const r of rows) {
    const status = r.problems.length ? 'FAIL' : r.warnings.length ? 'warn' : 'ok  ';
    lines.push(`${status} ${r.locale.padEnd(5)} ${r.file.padEnd(21)} ${String(r.length ?? '-').padStart(24)}  (limit ${r.limit})`);
    for (const p of r.problems) lines.push(`       - ${p}`);
    for (const w of r.warnings) lines.push(`       ~ ${w}`);
  }
  for (const p of problems) lines.push(`FAIL ${p}`);
  const locales = new Set(rows.map((r) => r.locale));
  if (values) lines.push(`placeholders filled from ${values.source}`);
  lines.push(ok ? `check-listing: ${locales.size} languages, ${rows.length} files, all within the Store limits and rules` : 'check-listing: problems found');
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  };
  const dir = opt('--dir') ? path.resolve(opt('--dir')) : DEFAULT_LISTING_DIR;
  const only = opt('--only') ? opt('--only').split(',').map((s) => s.trim()).filter(Boolean) : null;
  const result = checkListing(dir, { only });
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else console.log(formatReport(result));
  process.exit(result.ok ? 0 : 1);
}
