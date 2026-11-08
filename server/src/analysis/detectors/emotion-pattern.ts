/**
 * emotion-pattern: for emotions reported on at least 3 days - do they concentrate on one
 * weekday, or co-occur with a particular person or location?
 *
 *  - weekday: the top weekday holds >= 3 of the emotion's days, >= 50% of them, and at least
 *    twice the share that weekday has among all days (so a "Sunday" pattern is not just
 *    "the user writes on Sundays").
 *  - people / places: >= 3 co-occurrences and >= 60% of the emotion's days; a person or place
 *    that appears on more than 80% of all days is skipped (co-occurrence would be trivial).
 */
import { EMOTIONS, emotionLabel } from '@shared/constants';
import { lookup, type Locale } from '@shared/i18n';
import type { Insight } from '@shared/types';
import type { DayRecord } from '../../db/dataset';
import { round } from '../math';
import { fmtPercent, insufficientDataNote, onWeekday, strengthLabel, tr, weekdayPlural } from '../phrasing';
import { evidence, makeInsight, strengthFromThresholds } from '../scoring';
import { addNote, periodBounds, type Detector, type DetectorContext } from '../types';

export const MIN_EMOTION_DAYS = 3;
export const MIN_COOCCURRENCE = 3;
export const MIN_WEEKDAY_SHARE = 0.5;
export const MIN_WEEKDAY_LIFT = 2;
export const MIN_COOCCURRENCE_SHARE = 0.6;
export const MAX_BASELINE_SHARE = 0.8;
const WEEKDAY_THRESHOLDS: readonly [number, number, number] = [0.5, 0.65, 0.8];
const COOCCURRENCE_THRESHOLDS: readonly [number, number, number] = [0.6, 0.75, 0.9];
/** Upper bound on the number of emotion insights (highest scores first). */
const MAX_INSIGHTS = 8;

function positiveFor(emotion: string): boolean | null {
  const v = EMOTIONS.find((e) => e.key === emotion)?.valence;
  return v === 'positive' ? true : v === 'negative' ? false : null;
}

function slug(s: string): string {
  return s.trim().replace(/\s+/g, '_');
}

/** Localised emotion label from the 'emotions' catalogue ("Happy" / "שמח"), falling back to the shared constant. */
export function emotionName(locale: Locale, emotion: string): string {
  return lookup(locale, `emotions.${emotion}.label`) ?? emotionLabel(emotion);
}

function weekdayPattern(ctx: DetectorContext, emotion: string, days: DayRecord[]): Insight | null {
  const L = ctx.locale;
  const all = ctx.ds.days;
  const perWeekday = new Map<number, DayRecord[]>();
  for (const d of days) perWeekday.set(d.weekday, [...(perWeekday.get(d.weekday) ?? []), d]);
  let top: { weekday: number; days: DayRecord[] } | null = null;
  for (const [weekday, list] of perWeekday) if (!top || list.length > top.days.length) top = { weekday, days: list };
  if (!top || top.days.length < MIN_COOCCURRENCE) return null;
  const share = top.days.length / days.length;
  const baseline = all.filter((d) => d.weekday === top!.weekday).length / all.length;
  if (share < MIN_WEEKDAY_SHARE || share < baseline * MIN_WEEKDAY_LIFT) return null;
  const strength = strengthFromThresholds(share, WEEKDAY_THRESHOLDS);
  if (!strength) return null;
  const name = emotionName(L, emotion);
  const weekdays = weekdayPlural(L, top.weekday);
  const on = onWeekday(L, top.weekday);
  return makeInsight({
    id: `emotion_weekday_${emotion}_${top.weekday}`,
    category: 'emotion_pattern',
    strength,
    title: tr(L, 'analysis.emotion.weekdayTitle', { emotion: name, onWeekday: on }),
    text: tr(L, 'analysis.emotion.weekdayText', { emotion: name, onWeekday: on, top: top.days.length, total: days.length }),
    explanation: tr(L, 'analysis.emotion.weekdayExplain', {
      count: all.length,
      emotion: name,
      total: days.length,
      top: top.days.length,
      weekdays,
      share: fmtPercent(L, share),
      baseline: fmtPercent(L, baseline),
      strength: strengthLabel(L, strength),
    }),
    evidence: evidence({
      daysExamined: all.length,
      metricLabel: tr(L, 'analysis.emotion.metric', { emotion: name }),
      groupALabel: tr(L, 'analysis.emotion.groupA', { emotion: name }),
      groupACount: days.length,
      groupAMean: null,
      groupBLabel: tr(L, 'analysis.emotion.groupBWeekday', { weekdays }),
      groupBCount: top.days.length,
      groupBMean: null,
      effectSize: round(share, 2),
      dates: top.days.map((d) => d.date),
      extra: [
        { key: tr(L, 'analysis.extra.shareOfEmotionDays'), value: fmtPercent(L, share) },
        { key: tr(L, 'analysis.emotion.weekdayShareKey', { weekdays }), value: fmtPercent(L, baseline) },
        { key: tr(L, 'analysis.extra.strength'), value: strengthLabel(L, strength) },
      ],
    }),
    ...periodBounds(ctx),
    effect: share * 2,
    n: days.length,
    positive: positiveFor(emotion),
  });
}

function coOccurrence(
  ctx: DetectorContext,
  emotion: string,
  days: DayRecord[],
  kind: 'person' | 'place',
): Insight[] {
  const L = ctx.locale;
  const all = ctx.ds.days;
  const listOf = (d: DayRecord) => (kind === 'person' ? d.people : d.locations);
  const counts = new Map<string, DayRecord[]>();
  for (const d of days) for (const name of listOf(d)) counts.set(name, [...(counts.get(name) ?? []), d]);
  const out: Insight[] = [];
  const label = emotionName(L, emotion);
  for (const [name, withName] of counts) {
    if (withName.length < MIN_COOCCURRENCE) continue;
    const share = withName.length / days.length;
    if (share < MIN_COOCCURRENCE_SHARE) continue;
    const baselineCount = all.filter((d) => listOf(d).includes(name)).length;
    const baseline = baselineCount / all.length;
    if (baseline > MAX_BASELINE_SHARE) continue;
    const strength = strengthFromThresholds(share, COOCCURRENCE_THRESHOLDS);
    if (!strength) continue;
    // The person's name is used bare; a place name is quoted by the templates ({place}).
    const subject = kind === 'person' ? { name } : { place: name };
    const k = kind === 'person' ? 'person' : 'place';
    out.push(
      makeInsight({
        id: `emotion_${kind}_${emotion}_${slug(name)}`,
        category: 'people_places',
        strength,
        title: tr(L, `analysis.emotion.${k}Title`, { emotion: label, ...subject }),
        text: tr(L, `analysis.emotion.${k}Text`, { emotion: label, ...subject, with: withName.length, total: days.length }),
        explanation: tr(L, `analysis.emotion.${k}Explain`, {
          count: all.length,
          emotion: label,
          total: days.length,
          with: withName.length,
          share: fmtPercent(L, share),
          ...subject,
          baselineCount,
          baseline: fmtPercent(L, baseline),
          strength: strengthLabel(L, strength),
        }),
        evidence: evidence({
          daysExamined: all.length,
          metricLabel: tr(L, 'analysis.emotion.metric', { emotion: label }),
          groupALabel: tr(L, 'analysis.emotion.groupA', { emotion: label }),
          groupACount: days.length,
          groupAMean: null,
          groupBLabel: tr(L, kind === 'person' ? 'analysis.emotion.groupBPerson' : 'analysis.emotion.groupBPlace', subject),
          groupBCount: withName.length,
          groupBMean: null,
          effectSize: round(share, 2),
          dates: withName.map((d) => d.date),
          extra: [
            { key: tr(L, 'analysis.extra.shareOfEmotionDays'), value: fmtPercent(L, share) },
            { key: tr(L, kind === 'person' ? 'analysis.emotion.personShareKey' : 'analysis.emotion.placeShareKey', subject), value: fmtPercent(L, baseline) },
            { key: tr(L, 'analysis.extra.strength'), value: strengthLabel(L, strength) },
          ],
        }),
        ...periodBounds(ctx),
        effect: share * 2,
        n: days.length,
        positive: positiveFor(emotion),
      }),
    );
  }
  return out;
}

export const emotionPatternDetector: Detector = {
  id: 'emotion_pattern',
  label: (l) => tr(l, 'analysis.emotion.label'),
  detect(ctx) {
    const L = ctx.locale;
    const byEmotion = new Map<string, DayRecord[]>();
    for (const d of ctx.ds.days) for (const e of d.emotions) byEmotion.set(e, [...(byEmotion.get(e) ?? []), d]);
    const frequent = [...byEmotion].filter(([, days]) => days.length >= MIN_EMOTION_DAYS);
    if (frequent.length === 0) {
      addNote(ctx, insufficientDataNote(L, this.label(L), tr(L, 'analysis.req.emotionRepeated', { count: MIN_EMOTION_DAYS }), tr(L, 'analysis.have.noSuchEmotion')));
      return [];
    }
    const out: Insight[] = [];
    for (const [emotion, days] of frequent) {
      const w = weekdayPattern(ctx, emotion, days);
      if (w) out.push(w);
      out.push(...coOccurrence(ctx, emotion, days, 'person'));
      out.push(...coOccurrence(ctx, emotion, days, 'place'));
    }
    if (out.length === 0) {
      addNote(ctx, tr(L, 'analysis.emotion.nothing', { count: frequent.length, min: MIN_EMOTION_DAYS }));
    }
    return out.sort((a, b) => b.score - a.score).slice(0, MAX_INSIGHTS);
  },
};
