/**
 * Every registered search keyword table (shared/i18n/search) understands the questions it is
 * shipped with: the ten reference `examples` of each table are the English examples in the same
 * order, and the six example questions of the search page ('search.example.1'..'6') are shown in
 * every UI language. Each must parse to the same meaning as its English counterpart.
 */
import { describe, expect, it } from 'vitest';
import { LOCALE_CODES, t, type Locale } from '@shared/i18n';
import { SEARCH_TABLES } from '@shared/i18n/search';
import type { ParsedQuery } from '@shared/types';
import { parseQuery } from '../src/search';

const TODAY = '2026-09-07';

/** What a question means: intent, metric filter, period present, emotions (the words do not matter). */
function meaning(p: ParsedQuery): string {
  // emotion_days is answered from the emotions alone; a metric the emotion word also names is incidental.
  const metric = p.intent === 'emotion_days' ? '-' : (p.metric ?? '-');
  return [p.intent, metric, p.comparator ?? '-', p.threshold ?? '-', p.from ? 'period' : 'all', p.emotions.join('+') || '-'].join(' ');
}

describe('search tables', () => {
  const en = SEARCH_TABLES.en;
  if (!en) throw new Error('the English table is missing');
  const enMeanings = en.examples.map((q) => meaning(parseQuery(q, TODAY, 'en')));

  it('registers a table for every UI language', () => {
    expect(LOCALE_CODES.filter((code) => !SEARCH_TABLES[code])).toEqual([]);
  });

  it('parses the ten reference examples of every table like the English ones', () => {
    const wrong: string[] = [];
    for (const code of LOCALE_CODES) {
      const table = SEARCH_TABLES[code];
      if (!table) continue;
      expect({ code, count: table.examples.length }).toEqual({ code, count: en.examples.length });
      table.examples.forEach((q, i) => {
        const got = meaning(parseQuery(q, TODAY, code));
        if (got !== enMeanings[i]) wrong.push(`${code} #${i + 1} "${q}": ${got} (en: ${enMeanings[i]})`);
      });
    }
    expect(wrong).toEqual([]);
  });

  it('parses the six example questions of the search page in every language like the English ones', () => {
    const wrong: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const want = meaning(parseQuery(t('en', `search.example.${i}`), TODAY, 'en'));
      for (const code of LOCALE_CODES) {
        const q = t(code, `search.example.${i}`);
        const got = meaning(parseQuery(q, TODAY, code));
        if (got !== want) wrong.push(`${code} #${i} "${q}": ${got} (en: ${want})`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('comparators after the number', () => {
  const cases: Array<[string, string, ParsedQuery['comparator'], number, ParsedQuery['metric']]> = [
    ['ja', '睡眠が5時間未満だった日は？', 'lt', 5, 'sleepHours'],
    ['ja', '気分が8以上だった日', 'gte', 8, 'mood'],
    ['ja', '過去1年間で、エネルギーが8を超えた日', 'gt', 8, 'energy'],
    ['zh', '睡眠5小时以下的日子', 'lte', 5, 'sleepHours'],
    ['hi', 'किन दिनों मैंने पाँच घंटे से कम नींद ली?', 'lt', 5, 'sleepHours'],
    ['hi', 'किन दिनों मैं 7 घंटे या उससे ज़्यादा सोया?', 'gte', 7, 'sleepHours'],
    ['tr', 'Hangi günlerde beş saatten az uyudum?', 'lt', 5, 'sleepHours'],
    ['tr', "Ruh halimin 5'in altında olduğu günler", 'lt', 5, 'mood'],
    ['hu', 'Mely napokon aludtam öt óránál kevesebbet?', 'lt', 5, 'sleepHours'],
    ['en', 'Days I slept 6 hours or less', 'lte', 6, 'sleepHours'],
    ['de', 'Tage, an denen ich 5 Stunden oder weniger geschlafen habe', 'lte', 5, 'sleepHours'],
    ['fr', 'Les jours où j’ai dormi 7 heures au moins', 'gte', 7, 'sleepHours'],
    ['es', '¿Qué días dormí 6 horas o menos?', 'lte', 6, 'sleepHours'],
    ['pt', 'Dias em que dormi 8 horas ou mais', 'gte', 8, 'sleepHours'],
    ['it', 'Giorni in cui ho dormito 5 ore al massimo', 'lte', 5, 'sleepHours'],
  ];
  it.each(cases)('%s: %s', (locale, question, comparator, threshold, metric) => {
    const p = parseQuery(question, TODAY, locale as Locale);
    expect({ intent: p.intent, comparator: p.comparator, threshold: p.threshold, metric: p.metric }).toEqual({
      intent: 'metric_filter',
      comparator,
      threshold,
      metric,
    });
  });

  it('still prefers a comparator before the number', () => {
    expect(parseQuery('at least 7 hours of sleep', TODAY, 'en')).toMatchObject({ comparator: 'gte', threshold: 7 });
    expect(parseQuery('कम से कम 8 घंटे नींद वाले दिन', TODAY, 'hi')).toMatchObject({ comparator: 'gte', threshold: 8 });
  });
});
