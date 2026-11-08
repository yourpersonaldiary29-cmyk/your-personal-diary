/**
 * Search gaps found in the review and the earlier rounds (fictional diary content only):
 *   - "N last <unit>" word orders (fr/es/pt/ru), "<last> N de <unit>" (ro), "<unit> N <last>" (ar);
 *   - comparisons after the number: ja "7より高い" / "5より低い", tr "7'den yüksek" / "7den fazla"
 *     (with the genitive "stresin"), ar "8 ساعات على الأقل";
 *   - halves: hi "साढ़े सात" = 7.5, th "ห้าชั่วโมงครึ่ง" = 5.5;
 *   - cs spaced dates "7. 9. 2026", hu "két hete" (two weeks ago);
 *   - inflected search words (ru "о работе" finds "работа", pl, ar article).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Locale } from '@shared/i18n';
import { DiaryDb } from '../src/db/database';
import { smartSearch } from '../src/search/executor';
import { parseQuery, searchStems } from '../src/search/parser';
import { insertEntry } from './raw-fixtures';

const TODAY = '2026-09-30';
const q = (locale: string, text: string) => parseQuery(text, TODAY, locale as Locale);

describe('relative periods in every natural word order', () => {
  it.each([
    ['fr', 'les 3 derniers mois', '2026-07-03'],
    ['fr', 'ces 3 derniers mois', '2026-07-03'],
    ['fr', 'au cours des 3 derniers mois', '2026-07-03'],
    ['fr', 'les deux dernières semaines', '2026-09-17'],
    ['fr', 'les 2 dernières semaines', '2026-09-17'],
    ['fr', 'les 3 derniers jours', '2026-09-28'],
    ['fr', 'les derniers 3 mois', '2026-07-03'],
    ['es', 'los 3 últimos meses', '2026-07-03'],
    ['pt', 'as duas últimas semanas', '2026-09-17'],
    ['ru', 'за три последних месяца', '2026-07-03'],
    ['ro', 'ultimele 20 de zile', '2026-09-11'],
    ['ar', 'الأشهر الثلاثة الأخيرة', '2026-07-03'],
    ['ar', 'الأيام السبعة الأخيرة', '2026-09-24'],
    ['ar', 'آخر ثلاثة أشهر', '2026-07-03'],
    ['en', 'the last 3 days', '2026-09-28'],
    ['he', 'ב-5 הימים האחרונים', '2026-09-26'],
  ])('%s "%s" starts on %s', (locale, text, from) => {
    const p = q(locale, text);
    expect({ from: p.from, to: p.to }).toEqual({ from, to: TODAY });
    // The words of the period are not searched for as text.
    expect(p.textTerms.filter((w) => /derni|últim|последн|ultimel|الأخير/.test(w))).toEqual([]);
  });

  it('answers a mood-trend question for the period, not for the whole diary', () => {
    expect(q('fr', 'comment mon humeur a-t-elle évolué ces 3 derniers mois')).toMatchObject({ intent: 'trend_summary', from: '2026-07-03' });
    expect(q('ar', 'كيف تغير مزاجي خلال الأشهر الثلاثة الأخيرة')).toMatchObject({ intent: 'trend_summary', from: '2026-07-03' });
  });
});

describe('comparisons and halves', () => {
  it.each([
    ['ja', '今週ストレスが7より高い日', 'stress', 'gt', 7],
    ['ja', '気分が5より低い日', 'mood', 'lt', 5],
    ['tr', "stresin 7'den yüksek olduğu günler", 'stress', 'gt', 7],
    ['tr', 'stresin 7den fazla olduğu günler', 'stress', 'gt', 7],
    ['tr', "stres 7'den düşük olan günler", 'stress', 'lt', 7],
    ['ar', 'أيام نمت فيها 8 ساعات على الأقل', 'sleepHours', 'gte', 8],
    ['hi', 'साढ़े सात घंटे से कम नींद', 'sleepHours', 'lt', 7.5],
    ['th', 'นอนน้อยกว่าห้าชั่วโมงครึ่ง', 'sleepHours', 'lt', 5.5],
  ])('%s "%s" -> %s %s %s', (locale, text, metric, comparator, threshold) => {
    expect(q(locale, text)).toMatchObject({ intent: 'metric_filter', metric, comparator, threshold });
  });
});

describe('dates and "ago"', () => {
  it('reads a Czech date typed with spaces after the dots', () => {
    expect(q('cs', 'záznamy od 7. 9. 2026')).toMatchObject({ from: '2026-09-07', to: '2026-09-07' });
  });

  it('reads Hungarian possessive units as "ago"', () => {
    expect(q('hu', 'két hete')).toMatchObject({ from: '2026-09-16', to: '2026-09-16' });
    expect(q('hu', 'három napja')).toMatchObject({ from: '2026-09-27', to: '2026-09-27' });
  });
});

describe('inflected search words', () => {
  it('searchStems cuts case endings (and the Arabic article) but keeps short words whole', () => {
    expect(searchStems(['работе'], 'ru')).toEqual(['работ']);
    expect(searchStems(['pracy'], 'pl')).toEqual(['prac']);
    expect(searchStems(['العمل'], 'ar')).toEqual(['عمل']);
    expect(searchStems(['дом'], 'ru')).toEqual(['дом']);
    expect(searchStems(['sleep', 'walking'], 'en')).toEqual(['sleep', 'walking']);
  });

  it('also searches the regular form of a Hebrew final letter (עייף -> עייפה, עייפות)', () => {
    expect(searchStems(['עייף'], 'he')).toEqual(['עייף', 'עייפ']);
    expect(searchStems(['חלום', 'ים'], 'he')).toEqual(['חלום', 'חלומ', 'ים']);
    // Short words keep only their own form: "הימ" would also match "הימים" (the days).
    expect(searchStems(['הים'], 'he')).toEqual(['הים']);
    expect(searchStems(['עבודה'], 'he')).toEqual(['עבודה']);
  });

  describe('smartSearch', () => {
    let db: DiaryDb;
    beforeAll(async () => {
      db = await DiaryDb.create();
      insertEntry(db, { date: '2026-09-20', title: 'Будни', body: 'Сегодня была трудная работа.' });
      insertEntry(db, { date: '2026-09-21', title: 'Dzień', body: 'Dzisiaj praca była męcząca.' });
      insertEntry(db, { date: '2026-09-22', title: 'עייפות גדולה', body: 'הייתי עייפה כל היום.' });
      insertEntry(db, { date: '2026-09-23', title: 'יום ארוך', body: 'הרגשתי כבד ועייף.' });
      insertEntry(db, { date: '2026-09-24', title: 'חופש', body: 'שחינו בים כל הבוקר.' });
      insertEntry(db, { date: '2026-09-25', title: 'ימים טובים', body: 'היו כמה ימים שקטים.' });
    });

    it('matches a one- or two-letter Hebrew word only as a whole word (with prefixes)', () => {
      const he = smartSearch(db, { query: 'מתי כתבתי על ים?' }, TODAY, 'he');
      expect(he.entries.map((e) => e.title)).toEqual(['חופש']);
      expect(he.totalMatches).toBe(1);
    });

    it('finds the feminine and noun forms of a Hebrew word that ends in a final letter', () => {
      const he = smartSearch(db, { query: 'מתי כתבתי שאני עייף?' }, TODAY, 'he');
      expect(he.entries.map((e) => e.title)).toEqual(['יום ארוך', 'עייפות גדולה']);
    });

    it('finds "работа" when asked about "работе", and "praca" for "pracy"', () => {
      const ru = smartSearch(db, { query: 'записи о работе' }, TODAY, 'ru');
      expect(ru.entries.map((e) => e.title)).toEqual(['Будни']);
      const pl = smartSearch(db, { query: 'wpisy o pracy' }, TODAY, 'pl');
      expect(pl.entries.map((e) => e.title)).toEqual(['Dzień']);
    });
  });
});
