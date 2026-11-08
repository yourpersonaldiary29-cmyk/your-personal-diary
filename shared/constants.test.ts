import { describe, expect, it } from 'vitest';
import {
  APP_NAME,
  appName,
  backupFileName,
  EMOTIONS,
  EMOTION_KEYS,
  emotionAliases,
  emotionDefs,
  emotionKeyFromHebrew,
  emotionKeyFromWord,
  emotionLabel,
  emotionWords,
  HABIT_TEMPLATES,
  HABIT_TEMPLATE_SLUGS,
  habitTemplateBySlug,
  habitTemplates,
  METRIC_LABELS,
  METRIC_UNITS,
  metricLabel,
  metricUnit,
  MONTH_NAMES,
  NAV_ITEMS,
  navItems,
  navLabel,
  passwordProblem,
  passwordProblemKey,
  periodDays,
  periodLabel,
  periodOptions,
  PERIODS,
  usernameProblem,
  usernameProblemKey,
  WEEKDAY_NAMES,
} from './constants';
import { LOCALE_CODES, lookup, t } from './i18n';

describe('password policy', () => {
  it('accepts a password with letters and digits of at least 8 characters', () => {
    expect(passwordProblem('Diary2026')).toBeNull();
    expect(passwordProblem('סיסמה123')).toBeNull();
    expect(passwordProblemKey('Diary2026')).toBeNull();
  });
  it('rejects short passwords with a Hebrew message by default', () => {
    expect(passwordProblem('ab12')).toMatch(/לפחות 8 תווים/);
  });
  it('rejects passwords without digits or without letters', () => {
    expect(passwordProblem('abcdefgh')).toMatch(/אותיות וספרות/);
    expect(passwordProblem('12345678')).toMatch(/אותיות וספרות/);
  });
  it('rejects absurdly long passwords', () => {
    expect(passwordProblem('a1'.repeat(200))).toMatch(/ארוכה מדי/);
  });
  it('exposes the violation as a catalogue key with placeholders and renders it in any language', () => {
    expect(passwordProblemKey('ab12')).toEqual({ key: 'server.auth.passwordTooShort', params: { min: 8 } });
    expect(passwordProblemKey('abcdefgh')).toEqual({ key: 'server.auth.passwordNeedsLettersAndDigits' });
    expect(passwordProblemKey('a1'.repeat(200))).toEqual({ key: 'server.auth.passwordTooLong' });
    expect(passwordProblem('ab12', 'en')).toBe('The password must be at least 8 characters long');
    expect(passwordProblem('ab12', 'he')).toBe('הסיסמה חייבת להכיל לפחות 8 תווים');
    expect(passwordProblem('ab12', 'fr')).toBe(t('fr', 'server.auth.passwordTooShort', { min: 8 }));
  });
});

describe('username policy', () => {
  it('accepts latin, hebrew, digits, dot, dash and underscore between 3 and 32 chars', () => {
    expect(usernameProblem('dana_cohen')).toBeNull();
    expect(usernameProblem('דנה.כהן')).toBeNull();
    expect(usernameProblem('a-1')).toBeNull();
    expect(usernameProblemKey('a-1')).toBeNull();
  });
  it('rejects too short, too long and names with spaces or symbols', () => {
    expect(usernameProblem('ab')).not.toBeNull();
    expect(usernameProblem('x'.repeat(33))).not.toBeNull();
    expect(usernameProblem('dana cohen')).not.toBeNull();
    expect(usernameProblem('dana@home')).not.toBeNull();
  });
  it('renders the violation in the requested language', () => {
    expect(usernameProblemKey('ab')).toEqual({ key: 'server.auth.usernameInvalid' });
    expect(usernameProblem('ab')).toBe('שם המשתמש חייב להכיל 3 עד 32 תווים: אותיות, ספרות, נקודה, מקף או קו תחתון');
    expect(usernameProblem('ab', 'en')).toBe('The username must be 3 to 32 characters long: letters, digits, dot, hyphen or underscore');
  });
});

describe('emotions catalogue', () => {
  it('has unique keys and Hebrew labels for the emotions required by the product', () => {
    const keys = EMOTIONS.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const label of ['שמח', 'רגוע', 'עצוב', 'כועס', 'לחוץ', 'נרגש', 'עייף', 'מרוצה', 'מתוסכל', 'חרד', 'מלא אנרגיה']) {
      expect(EMOTIONS.some((e) => e.label === label)).toBe(true);
    }
    expect(EMOTION_KEYS.has('happy')).toBe(true);
  });
  it('resolves Hebrew words, including feminine forms and aliases, to keys', () => {
    expect(emotionKeyFromHebrew('עייף')).toBe('tired');
    expect(emotionKeyFromHebrew('עייפה')).toBe('tired');
    expect(emotionKeyFromHebrew('מודאגת')).toBe('anxious');
    expect(emotionKeyFromHebrew(' שמח ')).toBe('happy');
    expect(emotionKeyFromHebrew('לא רגש')).toBeNull();
    // Hebrew-only: an English word is not part of the legacy vocabulary.
    expect(emotionKeyFromHebrew('tired')).toBeNull();
  });
  it('maps keys back to labels and leaves unknown keys untouched', () => {
    expect(emotionLabel('calm')).toBe('רגוע');
    expect(emotionLabel('unknown-key')).toBe('unknown-key');
  });
  it('labels and aliases come from the catalogue of the requested language', () => {
    expect(emotionLabel('calm', 'en')).toBe('Calm');
    expect(emotionLabel('calm', 'he')).toBe('רגוע');
    expect(emotionLabel('calm', 'fr')).toBe(t('fr', 'emotions.calm.label'));
    expect(emotionAliases('tired', 'he')).toEqual(['עייפה', 'עייפות', 'מותש', 'מותשת', 'תשוש', 'תשושה']);
    expect(emotionAliases('tired', 'en')).toContain('exhausted');
    expect(emotionAliases('nope', 'en')).toEqual([]);
    const en = emotionDefs('en');
    expect(en.map((e) => e.key)).toEqual(EMOTIONS.map((e) => e.key));
    expect(en.map((e) => e.valence)).toEqual(EMOTIONS.map((e) => e.valence));
    expect(en.find((e) => e.key === 'energetic')?.label).toBe('Energetic');
    expect(emotionDefs('en')).toBe(en); // memoised
    for (const key of EMOTION_KEYS) {
      expect(lookup('en', `emotions.${key}.label`), key).not.toBeNull();
      expect(lookup('he', `emotions.${key}.label`), key).not.toBeNull();
      expect(lookup('en', `emotions.${key}.aliases`), key).not.toBeNull();
      expect(lookup('he', `emotions.${key}.aliases`), key).not.toBeNull();
    }
  });
  it('resolves words in the UI language, case-insensitively, then falls back to English and Hebrew', () => {
    expect(emotionKeyFromWord('Tired', 'en')).toBe('tired');
    expect(emotionKeyFromWord('exhausted', 'en')).toBe('tired');
    expect(emotionKeyFromWord(' Full of  energy ', 'en')).toBe('energetic');
    expect(emotionKeyFromWord('עייפה', 'en')).toBe('tired'); // Hebrew fallback
    expect(emotionKeyFromWord('tired', 'he')).toBe('tired'); // English fallback
    expect(emotionKeyFromWord('tired', 'he', [])).toBeNull();
    expect(emotionKeyFromWord('', 'en')).toBeNull();
    expect(emotionKeyFromWord('nothing-like-it', 'en')).toBeNull();
  });
  it('no word of a language maps to two different emotions', () => {
    for (const code of ['en', 'he'] as const) {
      const seen = new Map<string, string>();
      for (const def of emotionDefs(code)) {
        for (const word of [def.label, ...def.aliases]) {
          const w = word.toLowerCase();
          const other = seen.get(w);
          expect(other === undefined || other === def.key, `${code}: "${word}" is used by ${other} and ${def.key}`).toBe(true);
          seen.set(w, def.key);
        }
      }
      const words = emotionWords(code);
      expect(words.length).toBe(seen.size);
      expect(words.find((w) => w.word === emotionLabel('happy', code).toLowerCase())?.key).toBe('happy');
    }
  });
});

describe('habit templates', () => {
  it('offers the habit templates required by the product (Hebrew legacy list)', () => {
    const names = HABIT_TEMPLATES.map((h) => h.name);
    for (const n of ['הליכה', 'פעילות גופנית', 'שתיית מים', 'קריאה', 'לימודים', 'שינה בזמן', 'עבודה', 'זמן מול מחשב', 'זמן חברתי']) {
      expect(names).toContain(n);
    }
    expect(HABIT_TEMPLATES.every((h) => h.target > 0 && (h.frequency === 'daily' || h.frequency === 'weekly'))).toBe(true);
    expect(HABIT_TEMPLATES[0]).toMatchObject({ slug: 'walking', name: 'הליכה', description: 'הליכה יומית באוויר הפתוח', target: 30, unit: 'דקות', unitKey: 'minutes' });
  });
  it('translates name, description and unit per language and keeps the numbers', () => {
    const en = habitTemplates('en');
    expect(en.map((h) => h.slug)).toEqual(HABIT_TEMPLATE_SLUGS);
    expect(en[0]).toMatchObject({ slug: 'walking', name: 'Walking', unit: 'minutes', target: 30, frequency: 'daily' });
    expect(habitTemplateBySlug('water', 'he')).toMatchObject({ name: 'שתיית מים', unit: 'כוסות', target: 8 });
    expect(habitTemplateBySlug('water', 'en')).toMatchObject({ name: 'Drinking water', unit: 'glasses', target: 8 });
    expect(habitTemplateBySlug('water', 'fr')?.name).toBe(t('fr', 'habits.template.water.name'));
    expect(habitTemplateBySlug('nope')).toBeUndefined();
    expect(habitTemplates('en')).toBe(en); // memoised
    for (const slug of HABIT_TEMPLATE_SLUGS) {
      for (const code of ['en', 'he'] as const) {
        expect(lookup(code, `habits.template.${slug}.name`), `${code} ${slug}`).not.toBeNull();
        expect(lookup(code, `habits.template.${slug}.description`), `${code} ${slug}`).not.toBeNull();
      }
    }
  });
});

describe('periods, metrics and navigation', () => {
  it('knows the day count of every period', () => {
    expect(periodDays('7d')).toBe(7);
    expect(periodDays('1y')).toBe(365);
    expect(periodDays('all')).toBeNull();
    expect(periodLabel('3m')).toBe('3 חודשים');
    expect(PERIODS.map((p) => p.value)).toEqual(['7d', '30d', '3m', '6m', '1y', 'all']);
  });
  it('labels periods per language', () => {
    expect(periodLabel('3m', 'en')).toBe('3 months');
    expect(periodLabel('all', 'en')).toBe('All time');
    expect(periodLabel('all', 'he')).toBe('כל התקופה');
    expect(periodLabel('7d', 'fr')).toBe(t('fr', 'shell.period.7d'));
    expect(periodOptions('en').map((p) => p.label)).toEqual(['7 days', '30 days', '3 months', '6 months', 'Year', 'All time']);
    expect(periodOptions('en').map((p) => p.days)).toEqual(PERIODS.map((p) => p.days));
    expect(PERIODS.map((p) => p.labelKey)).toEqual(['shell.period.7d', 'shell.period.30d', 'shell.period.3m', 'shell.period.6m', 'shell.period.1y', 'shell.period.all']);
  });
  it('labels metrics and units per language', () => {
    expect(METRIC_LABELS.mood).toBe('מצב רוח');
    expect(METRIC_UNITS.sleepHours).toBe('שעות');
    expect(METRIC_UNITS.mood).toBe('');
    expect(metricLabel('mood', 'en')).toBe('Mood');
    expect(metricLabel('exerciseMinutes', 'en')).toBe('Exercise minutes');
    expect(metricLabel('entries', 'he')).toBe('רשומות יומן');
    expect(metricLabel('mood', 'fr')).toBe(t('fr', 'shell.metric.mood'));
    expect(metricLabel('unknown')).toBe('unknown');
    expect(metricUnit('sleepHours', 'en')).toBe('hours');
    expect(metricUnit('exerciseMinutes', 'he')).toBe('דקות');
    expect(metricUnit('entries', 'en')).toBe('entries');
    expect(metricUnit('mood', 'en')).toBe('');
    expect(metricUnit('unknown', 'en')).toBe('');
  });
  it('lists the navigation items in the order required by the product', () => {
    expect(NAV_ITEMS.map((n) => n.label)).toEqual([
      'דף הבית',
      'רשומה חדשה',
      'היומן שלי',
      'לוח שנה',
      'הרגלים',
      'תובנות',
      'סטטיסטיקות',
      'חיפוש',
      'גיבוי',
      'הגדרות',
    ]);
    expect(new Set(NAV_ITEMS.map((n) => n.key)).size).toBe(NAV_ITEMS.length);
  });
  it('labels navigation items per language', () => {
    expect(navItems('en').map((n) => n.label)).toEqual(['Home', 'New entry', 'My diary', 'Calendar', 'Habits', 'Insights', 'Statistics', 'Search', 'Backup', 'Settings']);
    expect(navItems('en').map((n) => n.path)).toEqual(NAV_ITEMS.map((n) => n.path));
    expect(navLabel('/diary', 'en')).toBe('My diary');
    expect(navLabel('/diary')).toBe('היומן שלי');
    expect(navLabel('/diary', 'fr')).toBe(t('fr', 'shell.nav.diary'));
    expect(navLabel('/nowhere', 'en')).toBe('/nowhere');
    expect(NAV_ITEMS[2].labelKey).toBe('shell.nav.diary');
  });
});

describe('names and Hebrew date tables', () => {
  it('names the product in English in every language (brand)', () => {
    expect(APP_NAME).toBe('Your Personal Diary');
    expect(appName('en')).toBe(APP_NAME);
    expect(appName('he')).toBe(APP_NAME);
    expect(appName('ja')).toBe(APP_NAME);
  });
  it('keeps the Hebrew weekday and month tables of the legacy UI', () => {
    expect(WEEKDAY_NAMES).toEqual(['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']);
    expect(MONTH_NAMES).toEqual(['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']);
  });
  it('every supported locale resolves the shared labels (through the English fallback at worst)', () => {
    for (const code of LOCALE_CODES) {
      expect(emotionLabel('happy', code)).not.toBe('emotions.happy.label');
      expect(periodLabel('7d', code)).not.toBe('shell.period.7d');
      expect(navLabel('/', code)).not.toBe('shell.nav.home');
      expect(metricLabel('mood', code)).not.toBe('shell.metric.mood');
      expect(habitTemplates(code)[0].name).not.toBe('habits.template.walking.name');
    }
  });
});

describe('backupFileName', () => {
  it('builds a safe file name from the username and the date', () => {
    expect(backupFileName('dana', '2026-09-07')).toBe('your-personal-diary-backup-dana-2026-09-07.mpd');
    // Every non [A-Za-z0-9_.-] character (8 of them here) becomes an underscore.
    expect(backupFileName('דנה כהן/1', '2026-09-07')).toBe('your-personal-diary-backup-________1-2026-09-07.mpd');
  });
});
