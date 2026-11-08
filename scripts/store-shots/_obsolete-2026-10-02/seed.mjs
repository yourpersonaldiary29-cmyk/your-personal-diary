/**
 * Fictional accounts for the Store screenshots, created through the API of the screenshot server
 * (never through the UI, never in the user's real data directory).
 *
 * For each account in config.mjs ACCOUNTS:
 *   1. register (or log in when it already exists) with a made-up password that is generated
 *      here and kept only in <tool dir>/accounts.local.json (never printed, never committed);
 *   2. save the account's UI language (PUT /api/settings { language });
 *   3. load the app's own sample data (POST /api/settings/seed-demo - the endpoint the Settings
 *      button "Load sample data" calls) for SEED_DAYS days;
 *   4. write a few extra, pleasant entries for today and yesterday, replace the generator's low-mood
 *      entries of the last two weeks with pleasant ones (GENTLE_DAYS) and tick today's habits a
 *      bit, so the home page looks alive and the trends of the listing shots are encouraging.
 *
 * Usage as a module: `const sessions = await ensureAccounts(BASE_URL)` -> [{ account, token, user }].
 * Usage from the command line: `node scripts/store-shots/seed.mjs` (server must be running).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { ACCOUNTS, ACCOUNTS_FILE, BASE_URL, SEED_DAYS } from './config.mjs';

// ---------------------------------------------------------------------------
// Small JSON client
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(status, body) {
    super(`${status} ${body && body.code ? body.code : ''} ${body && body.message ? body.message : ''}`.trim());
    this.status = status;
    this.body = body;
  }
}

export async function api(base, path, { method = 'GET', body, token, locale = 'en' } = {}) {
  const headers = { Accept: 'application/json', 'Accept-Language': locale };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = { code: 'OTHER', message: text.slice(0, 200) };
  }
  if (!res.ok) throw new ApiError(res.status, parsed);
  return parsed;
}

export async function waitForHealth(base, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const h = await api(base, '/api/health');
      if (h && h.ok) return h;
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server at ${base} did not answer /api/health in ${timeoutMs} ms (${lastError ? lastError.message : 'no answer'})`);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

function pad(n) {
  return String(n).padStart(2, '0');
}

export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso() {
  return isoDate(new Date());
}

export function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function nowHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A time of day for today's entry that is not in the future (the app never shows future entries). */
function todayTime(preferred) {
  return preferred < nowHHMM() ? preferred : nowHHMM();
}

// ---------------------------------------------------------------------------
// Passwords (made up, local only)
// ---------------------------------------------------------------------------

function readSavedPasswords() {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function makePassword() {
  // Letters + digits, 20 chars: satisfies the policy (>= 8 chars, letters and digits).
  return `Shot${crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, 'x')}7`;
}

function passwordFor(username) {
  const saved = readSavedPasswords();
  if (saved[username]) return saved[username];
  saved[username] = makePassword();
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(saved, null, 2), { encoding: 'utf8', mode: 0o600 });
  return saved[username];
}

// ---------------------------------------------------------------------------
// Extra entries (fictional, pleasant, neutral)
// ---------------------------------------------------------------------------

const EXTRA = {
  en: {
    yesterday: {
      time: '20:45',
      title: 'A good end to the week',
      body:
        'Finished the presentation I had been working on all week and sent it off before lunch - what a relief. In the afternoon I took a long walk along the beach with Noa, and we talked about the trip we want to plan for the spring. Cooked a new pasta dish in the evening; it turned out better than expected.',
      mood: 8,
      emotions: ['satisfied', 'calm'],
      energy: 7,
      stress: 3,
      sleepQuality: 7,
      sleepHours: 7,
      exerciseMinutes: 45,
      exerciseType: 'walking',
      events: ['Finished the presentation', 'Walk on the beach', 'Cooking a new dish'],
      people: ['Noa'],
      location: 'Beach',
      notes: 'Look up recipes for the weekend.',
      tags: ['work', 'friends', 'rest'],
    },
    today: {
      time: '10:20',
      title: 'A calm morning on the balcony',
      body:
        'Woke up without an alarm, made coffee and sat on the balcony with a book for almost an hour. The weather is finally cooler. Later I am meeting Amit at the park for a short run, and in the evening the whole family is coming over for dinner.',
      mood: 9,
      emotions: ['happy', 'calm', 'excited'],
      energy: 8,
      stress: 2,
      sleepQuality: 8,
      sleepHours: 8,
      exerciseMinutes: 25,
      exerciseType: 'running',
      events: ['Reading on the balcony', 'Family dinner'],
      people: ['Amit', 'Mom', 'Dad'],
      location: 'Home',
      notes: 'Buy flowers for the table.',
      tags: ['family', 'rest', 'nature'],
    },
    habitValues: { walk: 30, water: 5, reading: 20, meditation: 10 },
  },
  he: {
    yesterday: {
      time: '20:45',
      title: 'סיום טוב לשבוע',
      body:
        'סיימתי את המצגת שעבדתי עליה כל השבוע ושלחתי אותה לפני הצהריים - איזו הקלה. אחר הצהריים יצאתי להליכה ארוכה על חוף הים עם נועה, ודיברנו על הטיול שאנחנו רוצות לתכנן לאביב. בערב בישלתי פסטה חדשה, והיא יצאה טוב יותר ממה שציפיתי.',
      mood: 8,
      emotions: ['satisfied', 'calm'],
      energy: 7,
      stress: 3,
      sleepQuality: 7,
      sleepHours: 7,
      exerciseMinutes: 45,
      exerciseType: 'הליכה',
      events: ['סיום המצגת', 'הליכה על החוף', 'בישול מנה חדשה'],
      people: ['נועה'],
      location: 'חוף הים',
      notes: 'לחפש מתכונים לסוף השבוע.',
      tags: ['עבודה', 'חברים', 'מנוחה'],
    },
    today: {
      time: '10:20',
      title: 'בוקר רגוע במרפסת',
      body:
        'התעוררתי בלי שעון מעורר, הכנתי קפה וישבתי במרפסת עם ספר כמעט שעה. מזג האוויר סוף סוף נעים יותר. אחר כך אני נפגשת עם עמית בפארק לריצה קצרה, ובערב כל המשפחה מגיעה לארוחת ערב.',
      mood: 9,
      emotions: ['happy', 'calm', 'excited'],
      energy: 8,
      stress: 2,
      sleepQuality: 8,
      sleepHours: 8,
      exerciseMinutes: 25,
      exerciseType: 'ריצה',
      events: ['קריאה במרפסת', 'ארוחת ערב משפחתית'],
      people: ['עמית', 'אמא', 'אבא'],
      location: 'בית',
      notes: 'לקנות פרחים לשולחן.',
      tags: ['משפחה', 'מנוחה', 'טבע'],
    },
    habitValues: { walk: 30, water: 5, reading: 20, meditation: 10 },
  },
};

/**
 * Replacements for the demo's planted "rough days" that fall in the last two weeks (the generator
 * plants low-mood days on purpose for the analysis engine; 240 days keep plenty of them for the
 * insights, but a listing screenshot should not open on a gloomy fortnight). Each one is a
 * complete, self-consistent entry: the title, the text, the emotions and the numbers agree.
 *
 * Mood 7-8 against the generator's ~6 makes the 30-day mood trend clearly upward, so the first
 * insight of the Insights shot is the encouraging "upward trend in your mood" (positive numbers,
 * which also render correctly in the RTL Hebrew text) and the Statistics comparison with the
 * previous period is a "+". Stress stays near the generator's average on purpose, so a downward
 * stress trend (negative numbers) does not outrank it.
 */
const GENTLE_DAYS = {
  en: [
    {
      title: 'An easy work day',
      body: 'A quiet day at the office. I cleared most of my inbox before noon and spent the afternoon on the new design. A short walk in the park on the way home.',
      mood: 8, emotions: ['focused', 'calm'], energy: 7, stress: 4, sleepQuality: 7, sleepHours: 7.5,
      exerciseMinutes: 20, exerciseType: 'walking', events: ['Work on the new design'], people: [], location: 'Office', tags: ['work'],
    },
    {
      title: 'Dinner with friends',
      body: 'Rotem and Alon came over for dinner. We cooked together, played a board game and laughed until late. Exactly the evening I needed.',
      mood: 8, emotions: ['happy', 'grateful'], energy: 7, stress: 3, sleepQuality: 7, sleepHours: 7,
      exerciseMinutes: 0, exerciseType: '', events: ['Dinner with friends'], people: ['Rotem', 'Alon'], location: 'Home', tags: ['friends'],
    },
    {
      title: 'A productive morning',
      body: 'Got up early and finished the report before anyone else was online. Treated myself to a long lunch break in the sun and a swim after work.',
      mood: 8, emotions: ['energetic', 'satisfied'], energy: 8, stress: 4, sleepQuality: 8, sleepHours: 8,
      exerciseMinutes: 30, exerciseType: 'swimming', events: ['Finished the report'], people: [], location: 'Office', tags: ['work', 'sport'],
    },
    {
      title: 'Rain and a good book',
      body: 'It rained all afternoon, so I stayed in with tea and the novel Michal lent me. Called Mom in the evening; she is planning a visit next month.',
      mood: 7, emotions: ['calm', 'satisfied'], energy: 6, stress: 4, sleepQuality: 8, sleepHours: 8,
      exerciseMinutes: 0, exerciseType: '', events: ['Reading at home', 'Call with Mom'], people: ['Mom'], location: 'Home', tags: ['rest', 'family'],
    },
    {
      title: 'Market morning',
      body: 'Went to the farmers\' market early with Noa, bought peaches and fresh bread and had breakfast by the fountain. The afternoon went to laundry and a long phone call with Michal.',
      mood: 8, emotions: ['happy', 'grateful'], energy: 7, stress: 3, sleepQuality: 7, sleepHours: 7.5,
      exerciseMinutes: 40, exerciseType: 'walking', events: ['Farmers\' market'], people: ['Noa', 'Michal'], location: 'Market', tags: ['friends', 'rest'],
    },
    {
      title: 'Bike ride along the river',
      body: 'Took the bike out for the first time in weeks: forty minutes along the river path, then a quiet evening with a film.',
      mood: 8, emotions: ['energetic', 'calm'], energy: 8, stress: 3, sleepQuality: 8, sleepHours: 7.5,
      exerciseMinutes: 40, exerciseType: 'cycling', events: ['Bike ride'], people: [], location: 'River path', tags: ['sport', 'rest'],
    },
    {
      title: 'A full but good day',
      body: 'Meetings all morning and a deadline in the afternoon, but everything landed on time. Rewarded myself with takeout and an early night.',
      mood: 7, emotions: ['focused', 'satisfied'], energy: 6, stress: 5, sleepQuality: 7, sleepHours: 7,
      exerciseMinutes: 0, exerciseType: '', events: ['Deadline met'], people: [], location: 'Office', tags: ['work'],
    },
    {
      title: 'Lunch with the family',
      body: 'Lunch at my parents\' place. Dad showed me the new vegetable beds and Mom sent me home with soup; we played cards with my cousins until the evening.',
      mood: 8, emotions: ['happy', 'grateful'], energy: 7, stress: 2, sleepQuality: 7, sleepHours: 8,
      exerciseMinutes: 0, exerciseType: '', events: ['Family lunch'], people: ['Mom', 'Dad'], location: 'Parents\' home', tags: ['family'],
    },
  ],
  he: [
    {
      title: 'יום עבודה קל',
      body: 'יום שקט במשרד. פיניתי את רוב תיבת הדואר לפני הצהריים והקדשתי את אחר הצהריים לעיצוב החדש. הליכה קצרה בפארק בדרך הביתה.',
      mood: 8, emotions: ['focused', 'calm'], energy: 7, stress: 4, sleepQuality: 7, sleepHours: 7.5,
      exerciseMinutes: 20, exerciseType: 'הליכה', events: ['עבודה על העיצוב החדש'], people: [], location: 'משרד', tags: ['עבודה'],
    },
    {
      title: 'ארוחת ערב עם חברים',
      body: 'רותם ואלון באו לארוחת ערב. בישלנו יחד, שיחקנו משחק קופסה וצחקנו עד מאוחר. בדיוק הערב שהייתי צריכה.',
      mood: 8, emotions: ['happy', 'grateful'], energy: 7, stress: 3, sleepQuality: 7, sleepHours: 7,
      exerciseMinutes: 0, exerciseType: '', events: ['ארוחת ערב עם חברים'], people: ['רותם', 'אלון'], location: 'בית', tags: ['חברים'],
    },
    {
      title: 'בוקר פרודוקטיבי',
      body: 'קמתי מוקדם וסיימתי את הדוח לפני שכולם התחברו. פינקתי את עצמי בהפסקת צהריים ארוכה בשמש ובשחייה אחרי העבודה.',
      mood: 8, emotions: ['energetic', 'satisfied'], energy: 8, stress: 4, sleepQuality: 8, sleepHours: 8,
      exerciseMinutes: 30, exerciseType: 'שחייה', events: ['סיום הדוח'], people: [], location: 'משרד', tags: ['עבודה', 'ספורט'],
    },
    {
      title: 'גשם וספר טוב',
      body: 'ירד גשם כל אחר הצהריים, אז נשארתי בבית עם תה והרומן שמיכל השאילה לי. התקשרתי לאמא בערב; היא מתכננת ביקור בחודש הבא.',
      mood: 7, emotions: ['calm', 'satisfied'], energy: 6, stress: 4, sleepQuality: 8, sleepHours: 8,
      exerciseMinutes: 0, exerciseType: '', events: ['קריאה בבית', 'שיחה עם אמא'], people: ['אמא'], location: 'בית', tags: ['מנוחה', 'משפחה'],
    },
    {
      title: 'בוקר בשוק',
      body: 'יצאתי מוקדם לשוק האיכרים עם נועה, קנינו אפרסקים ולחם טרי ואכלנו ארוחת בוקר ליד המזרקה. אחר הצהריים הלך על כביסה ושיחת טלפון ארוכה עם מיכל.',
      mood: 8, emotions: ['happy', 'grateful'], energy: 7, stress: 3, sleepQuality: 7, sleepHours: 7.5,
      exerciseMinutes: 40, exerciseType: 'הליכה', events: ['שוק האיכרים'], people: ['נועה', 'מיכל'], location: 'שוק', tags: ['חברים', 'מנוחה'],
    },
    {
      title: 'רכיבה לאורך הנהר',
      body: 'הוצאתי את האופניים בפעם הראשונה מזה שבועות: ארבעים דקות לאורך שביל הנהר, ואחר כך ערב שקט עם סרט.',
      mood: 8, emotions: ['energetic', 'calm'], energy: 8, stress: 3, sleepQuality: 8, sleepHours: 7.5,
      exerciseMinutes: 40, exerciseType: 'רכיבה על אופניים', events: ['רכיבה על אופניים'], people: [], location: 'שביל הנהר', tags: ['ספורט', 'מנוחה'],
    },
    {
      title: 'יום עמוס אבל טוב',
      body: 'פגישות כל הבוקר ודדליין אחר הצהריים, אבל הכול נסגר בזמן. פינקתי את עצמי באוכל מבחוץ ובשינה מוקדמת.',
      mood: 7, emotions: ['focused', 'satisfied'], energy: 6, stress: 5, sleepQuality: 7, sleepHours: 7,
      exerciseMinutes: 0, exerciseType: '', events: ['עמידה בדדליין'], people: [], location: 'משרד', tags: ['עבודה'],
    },
    {
      title: 'ארוחת צהריים עם המשפחה',
      body: 'ארוחת צהריים אצל ההורים. אבא הראה לי את ערוגות הירקות החדשות ואמא שלחה אותי הביתה עם מרק; שיחקנו קלפים עם בני הדודים עד הערב.',
      mood: 8, emotions: ['happy', 'grateful'], energy: 7, stress: 2, sleepQuality: 7, sleepHours: 8,
      exerciseMinutes: 0, exerciseType: '', events: ['ארוחה משפחתית'], people: ['אמא', 'אבא'], location: 'בית ההורים', tags: ['משפחה'],
    },
  ],
};

/**
 * How many days back (from today) get the gentle rewrite: the whole 30-day window of the Insights
 * and Statistics shots, so the month compares favourably with the one before it.
 */
const GENTLE_WINDOW_DAYS = 31;

/** Rewrites the low-mood (< 7) demo entries of the last GENTLE_WINDOW_DAYS days (today included). */
export async function gentleLastWeek(base, account, token) {
  const opts = { token, locale: account.locale };
  const page = await api(base, `/api/entries?from=${daysAgoIso(GENTLE_WINDOW_DAYS)}&to=${todayIso()}&sortDesc=false&limit=200`, opts);
  const pool = GENTLE_DAYS[account.locale];
  let i = 0;
  let rewritten = 0;
  for (const summary of page.items) {
    if (summary.mood !== null && summary.mood >= 7) continue;
    const entry = await api(base, `/api/entries/${summary.id}`, opts);
    const gentle = pool[i++ % pool.length];
    const { id, createdAt, updatedAt, ...input } = entry;
    await api(base, `/api/entries/${id}`, { method: 'PUT', body: { ...input, ...gentle, notes: '' }, ...opts });
    rewritten++;
  }
  return rewritten;
}

/** The demo habits by their language-independent key, matched on the seed's names (server/src/db/seed.ts). */
const HABIT_NAMES = {
  en: { walk: 'Walking', water: 'Drinking water', reading: 'Reading', meditation: 'Meditation' },
  he: { walk: 'הליכה', water: 'שתיית מים', reading: 'קריאה', meditation: 'מדיטציה' },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function registerOrLogin(base, account, password) {
  const common = { username: account.username, password, rememberMe: false, deviceName: account.deviceName };
  try {
    const res = await api(base, '/api/auth/register', {
      method: 'POST',
      locale: account.locale,
      body: {
        ...common,
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        confirmPassword: password,
        language: account.locale,
      },
    });
    return { ...res, created: true };
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 409) throw e;
    const res = await api(base, '/api/auth/login', { method: 'POST', locale: account.locale, body: common });
    return { ...res, created: false };
  }
}

async function seedAccount(base, account, token) {
  const locale = account.locale;
  const opts = { token, locale };
  await api(base, '/api/settings', { method: 'PUT', body: { language: locale, theme: 'light' }, ...opts });

  const existing = await api(base, '/api/entries?limit=1', opts);
  let seeded = null;
  if (existing.total === 0) {
    seeded = await api(base, '/api/settings/seed-demo', { method: 'POST', body: { days: SEED_DAYS }, ...opts });
    const extra = EXTRA[locale];
    const today = todayIso();
    const yesterday = daysAgoIso(1);
    await api(base, '/api/entries', { method: 'POST', body: { ...extra.yesterday, date: yesterday }, ...opts });
    await api(base, '/api/entries', { method: 'POST', body: { ...extra.today, date: today, time: todayTime(extra.today.time) }, ...opts });
    await gentleLastWeek(base, account, token);

    // Tick today's habits so the "habits today" card shows real progress.
    const habits = await api(base, '/api/habits', opts);
    const names = HABIT_NAMES[locale];
    for (const [key, value] of Object.entries(extra.habitValues)) {
      const habit = habits.find((h) => h.name === names[key]);
      if (!habit) continue;
      await api(base, '/api/habits/logs', { method: 'PUT', body: { habitId: habit.id, date: today, value, note: '' }, ...opts });
    }
  }
  const page = await api(base, '/api/entries?limit=1', opts);
  return { seeded, totalEntries: page.total };
}

/**
 * Makes sure both fictional accounts exist with their data and returns a fresh session for each:
 * [{ account, token, user, created, seeded, totalEntries }].
 */
export async function ensureAccounts(base = BASE_URL, accounts = ACCOUNTS) {
  await waitForHealth(base);
  const out = [];
  for (const account of accounts) {
    const password = passwordFor(account.username);
    const auth = await registerOrLogin(base, account, password);
    const data = await seedAccount(base, account, auth.token);
    out.push({ account, token: auth.token, user: auth.user, created: auth.created, ...data });
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
if (isMain) {
  ensureAccounts()
    .then((sessions) => {
      for (const s of sessions) {
        console.log(
          `${s.account.key}: ${s.account.username} (${s.created ? 'created' : 'existing'}), ` +
            `${s.seeded ? `seeded ${s.seeded.entries} entries / ${s.seeded.habits} habits / ${s.seeded.habitLogs} logs + extras` : 'data already present'}, ` +
            `${s.totalEntries} entries in total`,
        );
      }
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
