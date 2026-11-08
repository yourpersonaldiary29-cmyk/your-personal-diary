/**
 * time-of-day: groups every mood report by the hour the entry was written
 * (05-10, 10-13, 13-17, 17-21, 21-05) and reports the window with the highest mean mood
 * when it beats the overall mean by at least ANALYSIS.weakDiff and holds >= 5 reports.
 */
import { ANALYSIS } from '@shared/constants';
import type { Locale } from '@shared/i18n';
import type { KeyValue } from '@shared/types';
import { mean, round } from '../math';
import { fmt1, fmtInt, insufficientDataNote, joinSemicolon, metricLabel, strengthLabel, tr } from '../phrasing';
import { evidence, makeInsight, strengthFromDiff } from '../scoring';
import { addNote, periodBounds, type Detector } from '../types';

export interface TimeBucket {
  /** Stable key; also the suffix of the catalogue keys 'analysis.timeOfDay.<key>.label' / '.phrase'. */
  key: 'morning' | 'late_morning' | 'afternoon' | 'evening' | 'night';
  hours: string;
  from: number;
  to: number;
}

export const TIME_BUCKETS: TimeBucket[] = [
  { key: 'morning', hours: '05:00-10:00', from: 5, to: 10 },
  { key: 'late_morning', hours: '10:00-13:00', from: 10, to: 13 },
  { key: 'afternoon', hours: '13:00-17:00', from: 13, to: 17 },
  { key: 'evening', hours: '17:00-21:00', from: 17, to: 21 },
  { key: 'night', hours: '21:00-05:00', from: 21, to: 5 },
];

/** Minimum mood reports inside a window before it can be reported. */
export const MIN_BUCKET_POINTS = 5;

/** Bucket for an HH:MM time (null for malformed times). */
export function bucketFor(time: string): TimeBucket | null {
  const hour = Number(time.slice(0, 2));
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  for (const b of TIME_BUCKETS) {
    if (b.from < b.to ? hour >= b.from && hour < b.to : hour >= b.from || hour < b.to) return b;
  }
  return null;
}

/** "Morning" / "בוקר" */
export function bucketLabel(locale: Locale, b: TimeBucket): string {
  return tr(locale, `analysis.timeOfDay.${b.key}.label`);
}

/** "in the morning" / "בשעות הבוקר" */
export function bucketPhrase(locale: Locale, b: TimeBucket): string {
  return tr(locale, `analysis.timeOfDay.${b.key}.phrase`);
}

export const timeOfDayDetector: Detector = {
  id: 'time_of_day',
  label: (l) => tr(l, 'analysis.timeOfDay.label'),
  detect(ctx) {
    const L = ctx.locale;
    const label = this.label(L);
    const perBucket = new Map<string, number[]>();
    const all: number[] = [];
    let daysWithPoints = 0;
    for (const d of ctx.ds.days) {
      let counted = false;
      for (const p of d.points) {
        if (p.mood == null) continue;
        const b = bucketFor(p.time);
        if (!b) continue;
        const arr = perBucket.get(b.key) ?? [];
        arr.push(p.mood);
        perBucket.set(b.key, arr);
        all.push(p.mood);
        counted = true;
      }
      if (counted) daysWithPoints++;
    }

    if (all.length < ANALYSIS.minDaysForRelationship) {
      addNote(ctx, insufficientDataNote(L, label, tr(L, 'analysis.req.moodReports', { count: ANALYSIS.minDaysForRelationship }), fmtInt(L, all.length)));
      return [];
    }
    const overall = mean(all) as number;

    const table: KeyValue[] = [];
    let best: { bucket: TimeBucket; values: number[]; mean: number } | null = null;
    for (const b of TIME_BUCKETS) {
      const values = perBucket.get(b.key) ?? [];
      if (values.length === 0) continue;
      const m = mean(values) as number;
      table.push({
        key: tr(L, 'analysis.timeOfDay.tableKey', { label: bucketLabel(L, b), hours: b.hours }),
        value: tr(L, 'analysis.timeOfDay.tableValue', { mean: fmt1(L, m), count: values.length }),
      });
      if (values.length >= MIN_BUCKET_POINTS && (!best || m > best.mean)) best = { bucket: b, values, mean: m };
    }
    if (!best) {
      addNote(ctx, insufficientDataNote(L, label, tr(L, 'analysis.req.reportsInWindow', { count: MIN_BUCKET_POINTS }), tr(L, 'analysis.have.fewerInEveryWindow')));
      return [];
    }

    const diff = best.mean - overall;
    const strength = strengthFromDiff(diff);
    if (!strength || diff < ANALYSIS.weakDiff) {
      addNote(ctx, tr(L, 'analysis.timeOfDay.nothing', { label, count: all.length }));
      return [];
    }
    const others = all.length - best.values.length;
    const othersMean = others > 0 ? (overall * all.length - best.mean * best.values.length) / others : null;
    const phrase = bucketPhrase(L, best.bucket);

    const text = tr(L, 'analysis.timeOfDay.text', { phrase, hours: best.bucket.hours, mean: fmt1(L, best.mean), overall: fmt1(L, overall) });
    const explanation = [
      tr(L, 'analysis.timeOfDay.explainChecked', { count: all.length, days: daysWithPoints }),
      tr(L, 'analysis.timeOfDay.explainTable', {
        table: joinSemicolon(
          L,
          table.map((row) => tr(L, 'analysis.timeOfDay.tableRow', { key: row.key, value: row.value })),
        ),
        overall: fmt1(L, overall),
      }),
      tr(L, 'analysis.timeOfDay.explainDiff', { diff: fmt1(L, diff), strength: strengthLabel(L, strength) }),
    ].join(' ');

    return [
      makeInsight({
        id: `time_of_day_${best.bucket.key}`,
        category: 'time_of_day',
        strength,
        title: tr(L, 'analysis.timeOfDay.title', { phrase }),
        text,
        explanation,
        evidence: evidence({
          daysExamined: daysWithPoints,
          metricLabel: metricLabel(L, 'mood'),
          groupALabel: tr(L, 'analysis.timeOfDay.groupA', { phrase, hours: best.bucket.hours }),
          groupACount: best.values.length,
          groupAMean: round(best.mean),
          groupBLabel: tr(L, 'analysis.timeOfDay.groupB'),
          groupBCount: others,
          groupBMean: othersMean == null ? null : round(othersMean),
          effectSize: round(diff),
          extra: [
            { key: tr(L, 'analysis.extra.overallMean'), value: fmt1(L, overall) },
            { key: tr(L, 'analysis.extra.strength'), value: strengthLabel(L, strength) },
            ...table,
          ],
        }),
        ...periodBounds(ctx),
        effect: diff,
        n: all.length,
        positive: null,
      }),
    ];
  },
};
