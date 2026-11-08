/**
 * Input forms the search tables alone cannot cover:
 * - full-width digits typed by Japanese / Chinese input methods ("５時間") count as numbers;
 * - a connector word may stand between a month and its year ("agosto de 2025", "Αύγουστο του 2025").
 */
import { describe, expect, it } from 'vitest';
import type { Locale } from '@shared/i18n';
import { normaliseQuery, parseQuery } from '../src/search';

const TODAY = '2026-09-07';

describe('full-width digits', () => {
  it('are normalised to ASCII digits', () => {
    expect(normaliseQuery('睡眠が５時間未満').text).toContain('5');
  });

  it.each([
    ['ja', '睡眠が５時間未満だった日', 'lt', 5],
    ['zh', '睡眠５小时以下的日子', 'lte', 5],
  ] as const)('%s: %s', (locale, question, comparator, threshold) => {
    const p = parseQuery(question, TODAY, locale);
    expect({ intent: p.intent, metric: p.metric, comparator: p.comparator, threshold: p.threshold }).toEqual({
      intent: 'metric_filter',
      metric: 'sleepHours',
      comparator,
      threshold,
    });
  });
});

describe('month, connector word, year', () => {
  it.each([
    ['es', '¿Qué días de agosto de 2025 dormí mal?'],
    ['pt', 'O meu humor em agosto de 2025'],
    ['it', 'il mio umore ad agosto del 2025'],
    ['el', 'τον Αύγουστο του 2025'],
    ['ro', 'dispoziția în august din 2025'],
    ['en', 'my mood in August 2025'],
  ] as const)('%s: %s -> August 2025', (locale, question) => {
    const p = parseQuery(question, TODAY, locale as Locale);
    expect({ from: p.from, to: p.to }).toEqual({ from: '2025-08-01', to: '2025-08-31' });
  });

  it('does not take a non-year number after a connector', () => {
    const p = parseQuery('días de agosto de 5 horas', TODAY, 'es');
    expect(p.from).toBe('2026-08-01');
  });
});
