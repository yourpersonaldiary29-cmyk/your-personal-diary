import { describe, expect, it } from 'vitest';
import {
  chineseScriptOf,
  civilDate,
  format,
  formatDate,
  formatNumber,
  formatTime,
  LOCALES,
  LOCALE_CODES,
  localeFromTag,
  monthNames,
  negotiateLocale,
  resolveLocale,
  standaloneMonthNames,
  t,
  weekdayNames,
} from './index';
import { AREA_NAMES, getArea, getCatalog } from './messages';

describe('template engine', () => {
  it('interpolates placeholders and escapes braces', () => {
    expect(format('en', 'Hello {name}!', { name: 'Dana' })).toBe('Hello Dana!');
    expect(format('en', 'literal {{braces}} and {x}', { x: 1 })).toBe('literal {braces} and 1');
    expect(format('en', 'missing {nope} stays empty')).toBe('missing  stays empty');
  });

  it('selects plural forms with Intl.PluralRules', () => {
    const tpl = '{count, plural, one {# entry} other {# entries}}';
    expect(format('en', tpl, { count: 1 })).toBe('1 entry');
    expect(format('en', tpl, { count: 3 })).toBe('3 entries');
    expect(format('en', tpl, { count: 0 })).toBe('0 entries');
    // Exact matches win over categories.
    expect(format('en', '{count, plural, =0 {none} one {one} other {many}}', { count: 0 })).toBe('none');
    // Russian has few/many.
    const ru = '{count, plural, one {# запись} few {# записи} many {# записей} other {# записи}}';
    expect(format('ru', ru, { count: 1 })).toBe('1 запись');
    expect(format('ru', ru, { count: 3 })).toBe('3 записи');
    expect(format('ru', ru, { count: 5 })).toBe('5 записей');
    // Hebrew: two.
    const he = '{count, plural, one {יום אחד} two {יומיים} other {# ימים}}';
    expect(format('he', he, { count: 2 })).toBe('יומיים');
    expect(format('he', he, { count: 7 })).toBe('7 ימים');
  });

  it('supports select and nested placeholders', () => {
    const tpl = '{kind, select, fast {Fast: {name}} major {Holiday: {name}} other {Observance: {name}}}';
    expect(format('en', tpl, { kind: 'fast', name: 'X' })).toBe('Fast: X');
    expect(format('en', tpl, { kind: 'minor', name: 'Y' })).toBe('Observance: Y');
  });

  it('falls back to English and then to the key', () => {
    expect(t('fr', 'no.such.key')).toBe('no.such.key');
  });
});

describe('numbers and dates', () => {
  it('formats numbers per locale without grouping', () => {
    expect(formatNumber('en', 7.25)).toBe('7.3');
    expect(formatNumber('de', 7.25)).toBe('7,3');
    expect(formatNumber('en', 12345)).toBe('12345');
  });

  it('formats civil dates in the locale', () => {
    expect(formatDate('en', '2026-09-07', 'full')).toBe('Monday, 7 September 2026');
    expect(formatDate('he', '2026-09-07', 'full')).toContain('7 בספטמבר 2026');
    expect(formatDate('fr', '2026-09-07', 'long')).toBe('7 septembre 2026');
    expect(formatDate('ja', '2026-09-07', 'long')).toBe('2026年9月7日');
    expect(formatDate('en', '2026-09-07', 'short')).toMatch(/07\/09\/2026|7\/9\/2026/);
    expect(formatDate('he', '2026-09-07', 'numeric')).toBe('07.09.2026');
    expect(formatDate('en', '2026-09-07', 'numeric')).toBe('07/09/2026');
    // Always the Gregorian year, also in Thai (whose default calendar is the Buddhist era: 2569).
    expect(formatDate('th', '2026-09-07', 'full')).toMatch(/2026/);
    expect(formatDate('th', '2026-09-07', 'short')).toMatch(/2026/);
    expect(formatDate('th', '2026-09-07', 'full')).not.toMatch(/2569/);
    expect(civilDate('2026-09-07').getUTCHours()).toBe(12);
    expect(() => civilDate('bad')).toThrow();
  });

  it('formats times and names', () => {
    expect(formatTime('en', '08:05')).toMatch(/08:05/);
    expect(weekdayNames('en')[0]).toBe('Sunday');
    expect(weekdayNames('he')[6]).toBe('יום שבת');
    expect(monthNames('es')[0]).toBe('enero');
    expect(monthNames('en', 'short')[11]).toBe('Dec');
  });

  it('names months in the nominative where the name stands alone (month picker, month list)', () => {
    // Greek: the month-only Intl format is the genitive in current ICU; a picker needs the nominative.
    expect(standaloneMonthNames('el')).toEqual([
      'Ιανουάριος',
      'Φεβρουάριος',
      'Μάρτιος',
      'Απρίλιος',
      'Μάιος',
      'Ιούνιος',
      'Ιούλιος',
      'Αύγουστος',
      'Σεπτέμβριος',
      'Οκτώβριος',
      'Νοέμβριος',
      'Δεκέμβριος',
    ]);
    expect(standaloneMonthNames('en')[9]).toBe('October');
    expect(standaloneMonthNames('ru')[9]).toBe('октябрь');
    expect(standaloneMonthNames('pl')[9]).toBe('październik');
    expect(standaloneMonthNames('cs')[9]).toBe('říjen');
    // Numeric month + year formats (zh, ja) keep the month-only name instead of a bare number.
    expect(standaloneMonthNames('zh')[9]).toBe(monthNames('zh')[9]);
    expect(standaloneMonthNames('ja')[9]).toBe(monthNames('ja')[9]);
    for (const code of LOCALE_CODES) {
      const names = standaloneMonthNames(code);
      expect(names, code).toHaveLength(12);
      expect(new Set(names).size, code).toBe(12);
      for (const name of names) expect(name, code).not.toMatch(/^\d+$/);
      // Every locale except Greek already names the month the same way in both formats.
      if (code !== 'el') expect(names, code).toEqual(monthNames(code));
    }
  });
});

describe('locales', () => {
  it('lists 20 locales with native names and picks by negotiation', () => {
    expect(LOCALES).toHaveLength(20);
    expect(LOCALES.find((l) => l.code === 'en')?.nativeName).toBe('English');
    expect(LOCALES.find((l) => l.code === 'he')?.dir).toBe('rtl');
    expect(LOCALES.find((l) => l.code === 'ar')?.dir).toBe('rtl');
    expect(negotiateLocale(['pt-BR', 'en'])).toBe('pt');
    expect(negotiateLocale('he-IL,en;q=0.8')).toBe('he');
    expect(negotiateLocale('xx')).toBe('en');
    expect(resolveLocale('zz')).toBe('en');
    expect(resolveLocale('ja')).toBe('ja');
  });

  /**
   * Real tags as Android (navigator.languages of the WebView = the phone's system languages,
   * Settings -> System -> Languages, in that order), Java and browsers write them.
   */
  describe('negotiating real language tags (Android system languages, browsers)', () => {
    it('ignores the region: every regional variant gets its language', () => {
      const cases: Array<[string, string]> = [
        ['pt-BR', 'pt'],
        ['pt-PT', 'pt'],
        ['es-419', 'es'],
        ['es-MX', 'es'],
        ['fr-CA', 'fr'],
        ['de-AT', 'de'],
        ['en-GB', 'en'],
        ['ar-EG', 'ar'],
        ['he-IL', 'he'],
        ['hi-IN', 'hi'],
        ['ru-UA', 'ru'],
      ];
      for (const [tag, locale] of cases) {
        expect(localeFromTag(tag), tag).toBe(locale);
        expect(negotiateLocale([tag]), tag).toBe(locale);
      }
    });

    it('reads any case and "_" as well as "-" separators', () => {
      expect(negotiateLocale(['PT-br'])).toBe('pt');
      expect(negotiateLocale(['pt_BR'])).toBe('pt');
      expect(negotiateLocale(['FR_ca'])).toBe('fr');
      expect(negotiateLocale(['ZH_hant_TW'])).toBe('zh');
      expect(negotiateLocale(['DE'])).toBe('de');
      expect(negotiateLocale(['  it-IT  '])).toBe('it');
      expect(negotiateLocale('pt_BR;q=0.9,en;q=0.5')).toBe('pt');
    });

    it('updates the legacy codes Android / Java still emit: iw -> he; in -> Indonesian (not an app language: passed over)', () => {
      expect(localeFromTag('iw')).toBe('he');
      expect(negotiateLocale(['iw-IL'])).toBe('he');
      expect(negotiateLocale(['iw_IL', 'en-US'])).toBe('he');
      expect(localeFromTag('in-ID')).toBeNull();
      expect(negotiateLocale(['in-ID'])).toBe('en');
      expect(negotiateLocale(['in_ID', 'fr-FR'])).toBe('fr');
      // Yiddish (ji) is not an app language either; Moldavian (mo) is Romanian.
      expect(negotiateLocale(['ji', 'de'])).toBe('de');
      expect(negotiateLocale(['mo-MD'])).toBe('ro');
    });

    it('reads script subtags and Unicode extensions', () => {
      expect(negotiateLocale(['sr-Latn-RS', 'ru-RU'])).toBe('ru');
      expect(negotiateLocale(['ar-EG-u-nu-latn'])).toBe('ar');
      expect(negotiateLocale(['en-US-u-mu-celsius'])).toBe('en');
      expect(negotiateLocale(['uz-Cyrl-UZ', 'tr-TR'])).toBe('tr');
    });

    it('Chinese: Simplified and Traditional tags all get the app\'s one (Simplified) Chinese catalogue', () => {
      // Simplified: explicit script, mainland / Singapore regions, or no region at all.
      for (const tag of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-CN', 'zh_CN', 'zh-hans-sg']) {
        expect(chineseScriptOf(tag), tag).toBe('Hans');
        expect(negotiateLocale([tag]), tag).toBe('zh');
      }
      // Traditional: explicit script, or Taiwan / Hong Kong / Macau as the WebView reports them
      // (it drops the script: zh-Hant-TW arrives as zh-TW). Still Chinese, not English.
      for (const tag of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-TW', 'zh-Hant-HK', 'zh_TW', 'ZH-HANT-tw']) {
        expect(chineseScriptOf(tag), tag).toBe('Hant');
        expect(negotiateLocale([tag]), tag).toBe('zh');
      }
      // The explicit script wins over the region.
      expect(chineseScriptOf('zh-Hans-TW')).toBe('Hans');
      expect(chineseScriptOf('zh-Hant-CN')).toBe('Hant');
    });

    it('the first supported language of the preference list wins', () => {
      expect(negotiateLocale(['sw-KE', 'he-IL', 'en-US'])).toBe('he');
      expect(negotiateLocale(['fr-CA', 'en-US'])).toBe('fr');
      expect(negotiateLocale(['en-GB', 'fr-FR'])).toBe('en');
      expect(negotiateLocale(['in-ID', 'iw-IL', 'ar-EG'])).toBe('he');
      expect(negotiateLocale(['zh-TW', 'en-US'])).toBe('zh');
      expect(negotiateLocale('xx-YY,ja-JP;q=0.8,de;q=0.5')).toBe('ja');
    });

    it('nothing supported (or nothing at all) -> English', () => {
      expect(negotiateLocale(['sw-KE', 'fil-PH', 'nb-NO'])).toBe('en');
      expect(negotiateLocale([])).toBe('en');
      expect(negotiateLocale(['', ' ', '*', 'und'])).toBe('en');
      expect(negotiateLocale('')).toBe('en');
      expect(negotiateLocale(null)).toBe('en');
      expect(negotiateLocale(undefined)).toBe('en');
      expect(localeFromTag(undefined)).toBeNull();
    });
  });

  /**
   * Placeholders used by a template, e.g. "{count} {name}" -> ['count', 'name'] (sorted, unique).
   * Understands the plural/select syntax: in "{metric, select, mood {mood} other {value}}" only
   * `metric` is a placeholder - the braces after an option name delimit the option's TEXT, which
   * is scanned recursively for nested placeholders.
   */
  function placeholdersOf(template: string): string[] {
    const found = new Set<string>();
    const matchBrace = (s: string, start: number): number => {
      let depth = 0;
      for (let i = start; i < s.length; i++) {
        if (s[i] === '{') depth++;
        else if (s[i] === '}' && --depth === 0) return i;
      }
      return -1;
    };
    const scanText = (s: string): void => {
      for (let i = 0; i < s.length; i++) {
        if (s[i] !== '{') continue;
        if (s[i + 1] === '{') {
          i++;
          continue;
        }
        const end = matchBrace(s, i);
        if (end < 0) return;
        scanArgument(s.slice(i + 1, end));
        i = end;
      }
    };
    const scanArgument = (inner: string): void => {
      const comma = inner.indexOf(',');
      if (comma < 0) {
        const name = inner.trim();
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) found.add(name);
        return;
      }
      found.add(inner.slice(0, comma).trim());
      const rest = inner.slice(comma + 1);
      const comma2 = rest.indexOf(',');
      if (comma2 < 0) return;
      const body = rest.slice(comma2 + 1);
      // Options: <name> {<text>} ... ; only the texts can hold placeholders.
      for (let i = 0; i < body.length; i++) {
        if (body[i] !== '{') continue;
        const end = matchBrace(body, i);
        if (end < 0) return;
        scanText(body.slice(i + 1, end));
        i = end;
      }
    };
    scanText(template);
    return [...found].sort();
  }

  it('every locale defines exactly the English key set per area with the same placeholders (parity)', () => {
    // Strict for every locale: all 20 are translated, so no catalogue may be empty or partial.
    const empty = LOCALE_CODES.filter(
      (code) => AREA_NAMES.reduce((n, area) => n + Object.keys(getArea(code, area)).length, 0) === 0,
    );
    expect(empty).toEqual([]);
    // Collect every problem first so one run reports all locales, not just the first mismatch.
    const problems: string[] = [];
    for (const area of AREA_NAMES) {
      const enArea = getArea('en', area);
      const enKeys = Object.keys(enArea).sort();
      for (const code of LOCALE_CODES) {
        const localArea = getArea(code, area);
        const keys = Object.keys(localArea).sort();
        for (const k of enKeys.filter((key) => !keys.includes(key))) problems.push(`${code}: missing ${k}`);
        for (const k of keys.filter((key) => !enKeys.includes(key))) problems.push(`${code}: extra ${k}`);
        for (const k of enKeys) {
          if (localArea[k] === undefined) continue;
          const want = placeholdersOf(enArea[k]).join(',');
          const got = placeholdersOf(localArea[k]).join(',');
          if (want !== got) problems.push(`${code}: ${k} placeholders [${got}] != [${want}]`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("keeps the brand 'Your Personal Diary' untranslated in every locale", () => {
    for (const code of LOCALE_CODES) {
      expect({ code, appName: getArea(code, 'shell')['shell.appName'] }).toEqual({ code, appName: 'Your Personal Diary' });
    }
  });

  it('every key carries its area prefix and every locale catalogue merges', () => {
    for (const code of LOCALE_CODES) {
      const cat = getCatalog(code);
      for (const key of Object.keys(cat)) {
        const area = key.split('.')[0];
        expect(AREA_NAMES as readonly string[]).toContain(area);
      }
    }
  });
});
