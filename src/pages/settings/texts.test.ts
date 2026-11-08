/**
 * The settings texts object resolves through the current UI language: every
 * getter yields real text (never a raw key) in English and in Hebrew, and the
 * templated phrases use the language's plural forms and number formatting.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH } from '@shared/constants';
import { LOCALE_CODES } from '@shared/i18n';
import { getArea } from '@shared/i18n/messages';
import enSettings from '@shared/i18n/messages/en/settings';
import heSettings from '@shared/i18n/messages/he/settings';
import { __resetLocaleForTests, setCurrentLocale } from '@/i18n/runtime';
import { formatBytes } from '@/utils/format';
import { ST } from './texts';

/** Placeholders used by a template (same rule as the shared parity test). */
function placeholdersOf(template: string): string[] {
  const found = new Set<string>();
  const re = /\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:[,}])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) found.add(m[1]);
  return [...found].sort();
}

describe('settings catalogue (en / he parity)', () => {
  it('defines the same keys with the same placeholders, all prefixed and non-empty', () => {
    expect(Object.keys(heSettings).sort()).toEqual(Object.keys(enSettings).sort());
    expect(Object.keys(enSettings).length).toBeGreaterThan(150);
    for (const [key, english] of Object.entries(enSettings)) {
      expect(key.startsWith('settings.'), key).toBe(true);
      expect(english.trim(), key).not.toBe('');
      expect(heSettings[key].trim(), key).not.toBe('');
      expect({ key, placeholders: placeholdersOf(heSettings[key]) }).toEqual({ key, placeholders: placeholdersOf(english) });
    }
  });

  it('no longer carries the privacy page, its data-folder block or the calendar toggles', () => {
    // The Privacy *card* keys (settings.privacy.title / offline*) are expected; the old page's other keys are not.
    // settings.privacy.policyLink: the card's link to the privacy policy page on the diary server (PLAY-LEGAL item 4).
    const privacyCard = new Set(['settings.privacy.title', 'settings.privacy.offlineLabel', 'settings.privacy.offlineHint', 'settings.privacy.offlineOn', 'settings.privacy.offlineOff', 'settings.privacy.policyLink']);
    const gone = Object.keys(enSettings).filter(
      (key) =>
        (key.startsWith('settings.privacy.') && !privacyCard.has(key)) ||
        key.startsWith('settings.offline.') ||
        key.startsWith('settings.calendar.') ||
        key === 'settings.data.privacyLink' ||
        key === 'settings.lan.blockedByOffline' ||
        key === 'settings.diagnostics.dataDir',
    );
    expect(gone).toEqual([]);
  });

  it('has one "Delete account" card in every locale: the old delete-all keys are gone, the new ones translated', () => {
    const OLD = ['deleteAll', 'deleteAllTitle', 'deleteAllWarning', 'deleteAllPasswordHint', 'deleteAllConfirm', 'deleteAllDone', 'wrongPassword'];
    const NEW = Object.keys(enSettings).filter((key) => key.startsWith('settings.deleteAccount.'));
    expect(NEW.sort()).toEqual(
      ['button', 'confirm', 'dialogTitle', 'done', 'ownerBoth', 'ownerHosted', 'ownerMail', 'ownerRemote', 'passwordHint', 'title', 'understand', 'warning', 'wrongPassword']
        .map((k) => `settings.deleteAccount.${k}`)
        .sort(),
    );
    for (const code of LOCALE_CODES) {
      const catalogue = getArea(code, 'settings');
      for (const k of OLD) expect(catalogue[`settings.data.${k}`], `${code} settings.data.${k}`).toBeUndefined();
      for (const key of NEW) {
        expect(catalogue[key]?.trim(), `${code} ${key}`).toBeTruthy();
        // Really translated (English only in English), and the dialog title names the account.
        if (code !== 'en') expect(catalogue[key], `${code} ${key}`).not.toBe(enSettings[key]);
      }
      expect(catalogue['settings.deleteAccount.dialogTitle'], code).toContain('{username}');
      expect(catalogue['settings.deleteAccount.ownerRemote'], code).toContain('DuckDNS');
      // The hosted server's owner line names the operator's variable (server/src/hosted/owner.ts).
      expect(catalogue['settings.deleteAccount.ownerHosted'], code).toContain('DIARY_OWNER_ID');
    }
    // The owner's wording in Hebrew.
    expect(heSettings['settings.deleteAccount.title']).toBe('מחיקת חשבון');
    expect(heSettings['settings.deleteAccount.button']).toBe('מחיקת חשבון');
  });

  it('never names the language ("עברית") outside the language picker', () => {
    for (const [key, value] of Object.entries(heSettings)) expect(value, key).not.toContain('עברית');
  });
});

/** Every getter of ST with its current value. */
function getterValues(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of Object.getOwnPropertyNames(ST)) {
    const desc = Object.getOwnPropertyDescriptor(ST, name);
    if (desc?.get) out[name] = (ST as Record<string, unknown>)[name];
  }
  return out;
}

describe('ST (settings texts)', () => {
  afterEach(() => {
    __resetLocaleForTests();
  });

  it('resolves every getter to real text in English and in Hebrew (no raw keys, no fallbacks)', () => {
    setCurrentLocale('en');
    const en = getterValues();
    setCurrentLocale('he');
    const he = getterValues();
    expect(Object.keys(en).length).toBeGreaterThan(100);
    for (const [name, value] of Object.entries(en)) {
      const text = Array.isArray(value) ? value.join('\n') : value;
      expect(typeof text, name).toBe('string');
      expect(text, name).not.toBe('');
      expect(text, name).not.toMatch(/(^|\s)settings\.[a-zA-Z.]+/);
      // A Hebrew value equal to the English one means the Hebrew key fell back to English.
      const hebrew = Array.isArray(he[name]) ? (he[name] as string[]).join('\n') : he[name];
      expect(hebrew, name).not.toBe(text);
      expect(hebrew, name).toMatch(/[֐-׿]/);
    }
  });

  it('keeps the exact Hebrew wording of the page titles and card names', () => {
    setCurrentLocale('he');
    expect(ST.settingsTitle).toBe('הגדרות');
    expect(ST.backupTitle).toBe('גיבוי, שחזור וייצוא');
    expect(ST.account).toBe('חשבון');
    expect(ST.display).toBe('תצוגה');
    expect(ST.security).toBe('אבטחה');
    expect(ST.reminders).toBe('תזכורות');
    expect(ST.data).toBe('נתונים');
    expect(ST.diagnostics).toBe('אבחון');
    expect(ST.lanInstructions).toHaveLength(4);
    expect(ST.newPasswordHint).toBe(`לפחות ${PASSWORD_MIN_LENGTH} תווים, עם אותיות וספרות`);
    // The owner's wording for the data card and the account card.
    expect(ST.dataReassurance).toBe('נתוני היומן שלך נשמרים בחשבון האישי שלך ומוצפנים מקצה לקצה.');
    expect(ST.editDetails).toBe('עריכת פרטים');
    expect(ST.setEmail).toBe('הגדר');
    expect(ST.lanAccess).toBe('גישה מהטלפון ברשת הביתית');
    setCurrentLocale('en');
    expect(ST.settingsTitle).toBe('Settings');
    expect(ST.newPasswordHint).toBe(`At least ${PASSWORD_MIN_LENGTH} characters, with letters and digits`);
    expect(ST.dataReassurance).toBe('Your diary data is stored in your personal account and encrypted end to end.');
    expect(ST.editDetails).toBe('Edit details');
    expect(ST.setEmail).toBe('Set');
  });

  it('uses plural forms per language for counted phrases', () => {
    setCurrentLocale('he');
    expect(ST.seedDemoDone(120, 4, 300)).toBe('נטענו 120 רשומות, 4 הרגלים ו-300 דיווחי הרגלים.');
    expect(ST.seedDemoDone(1, 1, 1)).toBe('נטענו רשומה אחת, הרגל אחד ודיווח הרגל אחד.');
    expect(ST.seedDemoDone(2, 2, 2)).toBe('נטענו שתי רשומות, שני הרגלים ושני דיווחי הרגלים.');
    expect(ST.restored(10, 2)).toBe('השחזור הושלם: 10 רשומות ושני הרגלים.');
    expect(ST.restored(1, 1)).toBe('השחזור הושלם: רשומה אחת והרגל אחד.');
    expect(ST.exportDone(1)).toBe('הייצוא הושלם: רשומה אחת.');
    expect(ST.exportDone(12)).toBe('הייצוא הושלם: 12 רשומות.');
    expect(ST.exportDoneWithFile(12, 'x.csv')).toBe('הייצוא הושלם: 12 רשומות. x.csv');
    expect(ST.serverLogLoaded(1)).toBe('יומן השרת נטען: שורה אחת.');
    expect(ST.serverLogLoaded(40)).toBe('יומן השרת נטען: 40 שורות.');
    expect(ST.seedDemoMessage).toContain('כ-120 ימים');

    setCurrentLocale('en');
    expect(ST.seedDemoDone(120, 4, 300)).toBe('Loaded 120 entries, 4 habits and 300 habit logs.');
    expect(ST.seedDemoDone(1, 1, 1)).toBe('Loaded 1 entry, 1 habit and 1 habit log.');
    expect(ST.restored(10, 2)).toBe('Restore complete: 10 entries and 2 habits.');
    expect(ST.exportDone(1)).toBe('Export complete: 1 entry.');
    expect(ST.exportDoneWithFile(12, 'x.csv')).toBe('Export complete: 12 entries. x.csv');
    expect(ST.serverLogLoaded(1)).toBe('Server log loaded: 1 line.');
    expect(ST.seedDemoMessage).toContain('About 120 days');
  });

  it('formats durations, sizes and option labels through the shared helpers', () => {
    setCurrentLocale('he');
    expect(ST.oneMinute).toBe('דקה אחת');
    expect(ST.minutes(5)).toBe('5 דקות');
    expect(ST.oneHour).toBe('שעה');
    expect(ST.minutes(60)).toBe(ST.oneHour);
    expect(ST.autoLockChanged(ST.minutes(10))).toBe('נעילה אוטומטית: 10 דקות');
    expect(ST.backupCreated('a.mpd', 4096)).toBe(`הגיבוי נוצר: a.mpd (${formatBytes(4096)}).`);
    expect(ST.themeLabel('high-contrast')).toBe('ניגודיות גבוהה');
    expect(ST.fontScaleOption('huge', 150)).toBe('ענק (150%)');
    expect(ST.customScale(120)).toBe('מותאם אישית (120%)');
    expect(ST.exportFormatLabel('json')).toBe('JSON - נתונים מלאים');
    expect(ST.exportFilterName('pdf')).toBe('מסמך PDF');
    expect(ST.copyName('http://x')).toBe('העתק http://x');
    expect(ST.deviceRevoked('טלפון')).toBe('המכשיר "טלפון" נותק.');
    expect(ST.firstDayChanged(ST.monday)).toBe('השבוע יתחיל ביום שני.');

    setCurrentLocale('en');
    expect(ST.oneMinute).toBe('1 minute');
    expect(ST.minutes(5)).toBe('5 minutes');
    expect(ST.oneHour).toBe('1 hour');
    expect(ST.backupCreated('a.mpd', 4096)).toBe(`Backup created: a.mpd (${formatBytes(4096)}).`);
    expect(ST.themeLabel('system')).toBe('Follow the system');
    expect(ST.exportFormatHint('csv')).toBe('For opening in Excel or a spreadsheet');
    expect(ST.exportFilterName('txt')).toBe('Text file');
    expect(ST.firstDayChanged(ST.sunday)).toBe('The week will start on Sunday.');
  });
});
