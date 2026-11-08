/**
 * Insight titles in every UI language: the length cap is a safety net for long user-provided
 * names, never something that cuts an ordinary title (Italian, German, Russian... run longer
 * than English and Hebrew), and when it does cut, it cuts between words.
 */
import { describe, expect, it } from 'vitest';
import { LOCALE_CODES } from '@shared/i18n';
import { generateInsights } from '../src/analysis/engine';
import { joinSemicolon, truncate } from '../src/analysis/phrasing';
import { TITLE_MAX } from '../src/analysis/scoring';
import { DiaryDb } from '../src/db/database';
import { seedDemoData } from '../src/db/seed';

const TODAY = '2026-09-07';

describe('truncate', () => {
  it('keeps short titles and cuts long ones between words', () => {
    expect(truncate('Short title', 20)).toBe('Short title');
    expect(truncate('Upward trend in your sleep hours in the last two weeks', 40)).toBe('Upward trend in your sleep hours in the…');
    // No space close enough to the limit (or none at all): a hard cut at the limit.
    expect(truncate('睡眠時間が上向きの傾向にあるようです', 8)).toBe('睡眠時間が上向…');
    expect(truncate('a'.repeat(50), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});

describe('joinSemicolon', () => {
  it('uses the semicolon of each script (in Greek ";" is a question mark)', () => {
    expect(joinSemicolon('en', ['a', 'b', 'c'])).toBe('a; b; c');
    expect(joinSemicolon('he', ['א', 'ב'])).toBe('א; ב');
    expect(joinSemicolon('ar', ['أ', 'ب'])).toBe('أ؛ ب');
    expect(joinSemicolon('el', ['α', 'β'])).toBe('α· β');
    expect(joinSemicolon('fr', ['a', 'b'])).toBe('a ; b');
    expect(joinSemicolon('zh', ['甲', '乙'])).toBe('甲；乙');
    expect(joinSemicolon('ja', ['甲'])).toBe('甲');
  });

  it('never leaves an ASCII ";" in Greek or Arabic explanations of the demo data', async () => {
    const db = await DiaryDb.create();
    seedDemoData(db, 120, 42, TODAY, 'en');
    for (const locale of ['el', 'ar'] as const) {
      const report = generateInsights(db, 'all', TODAY, {}, locale);
      const explanations = report.insights.filter((i) => i.category === 'anomaly' || i.category === 'time_of_day').map((i) => i.explanation);
      expect(explanations.length).toBeGreaterThan(0);
      for (const text of explanations) expect(text).not.toContain(';');
    }
  });
});

describe('insight titles in all languages', () => {
  it('never truncates a demo-data title in any locale', async () => {
    const db = await DiaryDb.create();
    seedDemoData(db, 120, 42, TODAY, 'en');
    const cut: string[] = [];
    for (const locale of LOCALE_CODES) {
      for (const period of ['30d', '3m', 'all'] as const) {
        for (const insight of generateInsights(db, period, TODAY, {}, locale).insights) {
          expect(insight.title.length).toBeLessThanOrEqual(TITLE_MAX);
          if (insight.title.endsWith('…')) cut.push(`${locale}: ${insight.title}`);
        }
      }
    }
    expect(cut).toEqual([]);
  });
});

describe('insight evidence', () => {
  it('never shows the same difference twice (effectSize row + a "mean difference" extra row)', async () => {
    const { DiaryDb } = await import('../src/db/database');
    const { seedDemoData } = await import('../src/db/seed');
    const { generateInsights } = await import('../src/analysis/engine');
    const { t } = await import('@shared/i18n');
    const db = await DiaryDb.create();
    seedDemoData(db, 120, 42, '2026-09-30', 'en');
    const report = generateInsights(db, '3m', '2026-09-30', {}, 'en');
    const meanDiffLabel = t('en', 'analysis.extra.meanDiff');
    for (const insight of report.insights) {
      expect(insight.evidence.extra.map((kv) => kv.key)).not.toContain(meanDiffLabel);
    }
    expect(report.insights.some((i) => i.evidence.effectSize !== null)).toBe(true);
  });
});
