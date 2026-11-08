import { describe, expect, it } from 'vitest';
import { PERIODS } from '@shared/constants';
import { setCurrentLocale } from '@/i18n/runtime';
import { pinLocaleForTests } from '@/i18n/test-utils';
import { DIRECTION_LABELS, INSIGHT_GROUPS, OTHER_GROUP, STRENGTH_LABELS } from './insight-groups';
import { inPeriodText, periodLabelText, periodOptions } from './periods';

// Hebrew is the reference wording of the original app; English is the product default.
pinLocaleForTests('he');

describe('periods', () => {
  it('Hebrew labels match the legacy PERIODS labels and the options keep the shared order', () => {
    for (const p of PERIODS) expect(periodLabelText(p.value)).toBe(p.label);
    expect(periodOptions().map((o) => o.value)).toEqual(PERIODS.map((p) => p.value));
    expect(inPeriodText('30d')).toBe('ב-30 ימים');
    expect(inPeriodText('1y')).toBe('בשנה');
    expect(inPeriodText('all')).toBe('בכל התקופה');
  });

  it('switches to English with the UI language', () => {
    setCurrentLocale('en');
    expect(periodLabelText('7d')).toBe('7 days');
    expect(periodLabelText('3m')).toBe('3 months');
    expect(periodLabelText('all')).toBe('All time');
    expect(inPeriodText('30d')).toBe('in the last 30 days');
    expect(inPeriodText('1y')).toBe('in the last year');
    expect(periodOptions()[0]).toEqual({ value: '7d', label: '7 days' });
  });
});

describe('insight labels', () => {
  it('group, strength and direction labels follow the UI language', () => {
    expect(INSIGHT_GROUPS.map((g) => g.title)).toEqual(['מגמות', 'הרגלים', 'שינה ופעילות', 'ימים ושעות', 'רגשות ואנשים', 'חריגות']);
    expect(OTHER_GROUP.title).toBe('תובנות נוספות');
    expect(STRENGTH_LABELS.strong).toBe('דפוס חזק');
    expect(STRENGTH_LABELS.moderate).toBe('דפוס בינוני');
    expect(DIRECTION_LABELS.attention).toBe('לתשומת לב');

    setCurrentLocale('en');
    expect(INSIGHT_GROUPS.map((g) => g.title)).toEqual(['Trends', 'Habits', 'Sleep and activity', 'Days and times', 'Emotions and people', 'Anomalies']);
    expect(OTHER_GROUP.title).toBe('Other insights');
    expect(STRENGTH_LABELS.weak).toBe('Weak pattern');
    expect(DIRECTION_LABELS.positive).toBe('Encouraging');
  });
});
