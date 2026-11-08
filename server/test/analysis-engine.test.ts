/**
 * Analysis engine: a diary with planted relationships must yield the expected insights
 * (right ids, categories, sensible strengths, group means that match the data, hedged
 * Hebrew wording and explanations that quote the counts); random data must not produce
 * strong relationships; too little data yields notes; a failing detector is isolated.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANALYSIS } from '@shared/constants';
import type { Insight, InsightCategory, InsightStrength, InsightsReport } from '@shared/types';
import { generateInsights, MAX_INSIGHTS } from '../src/analysis/engine';
import { sleepMoodDetector } from '../src/analysis/detectors';
import { RulesProvider, type AnalysisProvider } from '../src/analysis/provider';
import type { Detector } from '../src/analysis/types';
import { DiaryDb } from '../src/db/database';
import { mulberry32 } from '../src/db/seed';
import { addDays, dayNumber, weekday, weekStart } from '../src/util/dates';
import { insertEntry, insertHabit, insertLog } from './raw-fixtures';

const TODAY = '2026-09-07'; // a Monday
const DAYS = 80;
const FIRST = addDays(TODAY, -(DAYS - 1)); // 2026-06-20, a Saturday
const ANOMALY_INDEX = 40;
const HEBREW = /[א-ת]/;
/** Causal wording that must never appear in an insight (ARCHITECTURE.md 8.2). */
const CAUSAL = /גורם|גורמת|בגלל|מוביל ל/;
const STRENGTHS: InsightStrength[] = ['weak', 'moderate', 'strong'];
const RELATIONSHIP_CATEGORIES: InsightCategory[] = [
  'sleep_mood',
  'sleep_energy',
  'exercise_energy',
  'exercise_mood',
  'habit_mood',
  'correlation',
  'weekday',
  'time_of_day',
];

interface PlantedDay {
  date: string;
  weekday: number;
  lowSleep: boolean;
  exercise: boolean;
  readingWeek: boolean;
  /** Mood of the evening entry. */
  eveningMood: number;
  /** Mood of the optional late-morning entry. */
  middayMood: number | null;
  /** Mean of the day's entry moods - what the dataset computes for the day. */
  dayMood: number;
  energy: number;
  stress: number;
}

interface Planted {
  days: PlantedDay[];
  reading: number;
  water: number;
  anomalyDate: string;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * 80 days with planted relationships (seeded, so every run sees the same diary):
 *  - sleep < 6h  -> mood about 2 points lower
 *  - exercise    -> energy about 2 points higher
 *  - Sundays     -> stress about 2.5 points higher
 *  - alternate "reading weeks" (weekly habit at target) -> mood about 1.5 higher
 *  - a late-morning (11:00) entry on ~35% of days with mood 1.5 above the evening entry
 *  - one anomalous day (mood 1, stress 10)
 *  - September (7 days) about 1.5 mood points above August
 *  - daily habit "מים": completed on ~30% of the early days, 4/14 in the previous two weeks,
 *    13/14 in the last two weeks (a clear improvement) and every one of the last 7 days
 */
function plantDiary(db: DiaryDb): Planted {
  const rng = mulberry32(2026);
  const noise = (scale: number) => (rng() + rng() - 1) * scale;
  const clamp = (x: number) => Math.min(10, Math.max(1, Math.round(x)));
  const reading = insertHabit(db, { name: 'קריאה', target: 4, unit: 'פעמים', frequency: 'weekly', sortOrder: 0 });
  const water = insertHabit(db, { name: 'מים', target: 8, unit: 'כוסות', frequency: 'daily', sortOrder: 1 });
  const firstWeek = weekStart(FIRST, 0);
  const days: PlantedDay[] = [];
  let anomalyDate = '';

  for (let i = 0; i < DAYS; i++) {
    const date = addDays(FIRST, i);
    const wd = weekday(date);
    const weekIndex = Math.round((dayNumber(weekStart(date, 0)) - dayNumber(firstWeek)) / 7);
    const readingWeek = weekIndex % 2 === 0;
    const anomaly = i === ANOMALY_INDEX;
    const lowSleep = !anomaly && rng() < 0.25;
    const sleepHours = lowSleep ? 4 + Math.floor(rng() * 4) * 0.5 : 6.5 + Math.floor(rng() * 6) * 0.5;
    const exerciseMinutes = rng() < 0.45 ? 20 + Math.floor(rng() * 41) : 0;
    const september = date >= '2026-09-01';

    let eveningMood = clamp(6.5 + noise(1.2) - (lowSleep ? 2 : 0) + (readingWeek ? 1.5 : 0) + (september ? 1.5 : 0));
    let energy = clamp(5 + noise(1.2) + (exerciseMinutes > 0 ? 2 : 0));
    let stress = clamp(4 + noise(1.2) + (wd === 0 ? 2.5 : 0));
    if (anomaly) {
      eveningMood = 1;
      energy = 2;
      stress = 10;
      anomalyDate = date;
    }
    const middayMood = !anomaly && rng() < 0.35 ? clamp(eveningMood + 1.5) : null;
    const emotions = eveningMood >= 8 ? ['happy'] : eveningMood <= 4 ? ['sad'] : ['calm'];

    insertEntry(db, {
      date,
      time: '20:30',
      title: `יום ${i + 1}`,
      body: anomaly ? 'יום נורא, הכול השתבש.' : 'סיכום היום.',
      mood: eveningMood,
      energy,
      stress,
      sleepHours,
      exerciseMinutes,
      exerciseType: exerciseMinutes > 0 ? 'הליכה' : '',
      emotions,
    });
    if (middayMood != null) {
      insertEntry(db, { date, time: '11:00', title: 'צהריים', body: 'כמה מילים באמצע היום.', mood: middayMood, energy, stress });
    }

    // Weekly reading habit: five logs (Sun..Thu) in reading weeks, one (Wednesday) otherwise.
    if (readingWeek ? wd <= 4 : wd === 3) insertLog(db, reading, date, 1, true);

    // Daily water habit: sparse early on, 4/14 in the previous window, 13/14 in the last window.
    let waterValue: number;
    if (i >= DAYS - 14) waterValue = i === DAYS - 8 ? 3 : 8;
    else if (i >= DAYS - 28) waterValue = i % 3 === 0 ? 8 : 3;
    else waterValue = rng() < 0.3 ? 8 : 3;
    insertLog(db, water, date, waterValue, waterValue >= 8);

    days.push({
      date,
      weekday: wd,
      lowSleep,
      exercise: exerciseMinutes > 0,
      readingWeek,
      eveningMood,
      middayMood,
      dayMood: middayMood == null ? eveningMood : (eveningMood + middayMood) / 2,
      energy,
      stress,
    });
  }
  return { days, reading, water, anomalyDate };
}

/** 200 days of independent uniform noise: no relationship should come out strong. */
function plantUniform(db: DiaryDb): void {
  const rng = mulberry32(99);
  const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const first = addDays(TODAY, -199);
  for (let i = 0; i < 200; i++) {
    const exercise = rng() < 0.5 ? int(20, 60) : 0;
    insertEntry(db, {
      date: addDays(first, i),
      time: `${String(int(6, 23)).padStart(2, '0')}:00`,
      title: `יום ${i + 1}`,
      body: 'רשומה אקראית.',
      mood: int(1, 10),
      energy: int(1, 10),
      stress: int(1, 10),
      sleepHours: 4 + int(0, 10) * 0.5,
      exerciseMinutes: exercise,
      exerciseType: exercise ? 'הליכה' : '',
    });
  }
}

function byId(report: InsightsReport, id: string): Insight {
  const found = report.insights.find((i) => i.id === id);
  if (!found) throw new Error(`insight ${id} missing; got: ${report.insights.map((i) => i.id).join(', ')}`);
  return found;
}

function expectSaneInsight(insight: Insight, report: InsightsReport): void {
  expect(STRENGTHS).toContain(insight.strength);
  expect(insight.title.length).toBeGreaterThan(0);
  expect(insight.title.length).toBeLessThanOrEqual(60);
  expect(insight.title).toMatch(HEBREW);
  expect(insight.text).toMatch(HEBREW);
  expect(insight.explanation).toMatch(HEBREW);
  for (const s of [insight.title, insight.text, insight.explanation]) expect(s).not.toMatch(CAUSAL);
  expect(insight.periodStart).toBe(report.periodStart);
  expect(insight.periodEnd).toBe(report.periodEnd);
  expect(insight.score).toBeGreaterThan(0);
  expect(Array.isArray(insight.evidence.dates)).toBe(true);
  expect(Array.isArray(insight.evidence.extra)).toBe(true);
}

describe('generateInsights on a diary with planted patterns', () => {
  let db: DiaryDb;
  let planted: Planted;
  let report: InsightsReport;

  async function ensure(): Promise<void> {
    if (report) return;
    db = await DiaryDb.create();
    planted = plantDiary(db);
    report = generateInsights(db, '3m', TODAY, {}, 'he');
  }

  it('describes the period and produces a sorted, deduplicated, well-formed list', async () => {
    await ensure();
    expect(report.provider).toBe('rules-v1');
    expect(report.period).toBe('3m');
    expect(report.periodStart).toBe(addDays(TODAY, -89));
    expect(report.periodEnd).toBe(TODAY);
    expect(report.daysWithData).toBe(DAYS);
    expect(Date.parse(report.generatedAt)).not.toBeNaN();
    expect(report.insights.length).toBeGreaterThanOrEqual(8);
    expect(report.insights.length).toBeLessThanOrEqual(MAX_INSIGHTS);
    const ids = report.insights.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < report.insights.length; i++) {
      expect(report.insights[i - 1].score).toBeGreaterThanOrEqual(report.insights[i].score);
    }
    for (const insight of report.insights) expectSaneInsight(insight, report);
    for (const note of report.notes) {
      expect(note).toMatch(HEBREW);
      expect(note).not.toMatch(CAUSAL);
    }
  });

  it('finds that short sleep comes with lower mood, with the right counts and means', async () => {
    await ensure();
    const insight = byId(report, 'sleep_mood_lt6');
    expect(insight.category).toBe('sleep_mood');
    expect(insight.strength).toBe('strong');
    const low = planted.days.filter((d) => d.lowSleep);
    const rest = planted.days.filter((d) => !d.lowSleep);
    expect(low.length).toBeGreaterThanOrEqual(ANALYSIS.minGroupSize);
    const ev = insight.evidence;
    expect(ev.daysExamined).toBe(DAYS);
    expect(ev.groupACount).toBe(low.length);
    expect(ev.groupBCount).toBe(rest.length);
    expect(ev.metricLabel).toBe('מצב רוח');
    // Evidence means are rounded to one decimal.
    expect(Math.abs((ev.groupAMean as number) - mean(low.map((d) => d.dayMood)))).toBeLessThanOrEqual(0.051);
    expect(Math.abs((ev.groupBMean as number) - mean(rest.map((d) => d.dayMood)))).toBeLessThanOrEqual(0.051);
    expect((ev.groupBMean as number) - (ev.groupAMean as number)).toBeGreaterThan(ANALYSIS.strongDiff);
    expect(ev.effectSize).toBeLessThan(0);
    // More hours of sleep go with higher mood: a positive Pearson r over the continuous form.
    expect(ev.correlation).not.toBeNull();
    expect(ev.correlation as number).toBeGreaterThan(ANALYSIS.weakR);
    // Hedged sentence, explanation quotes the counts and the means.
    expect(insight.text.startsWith('נראה שבנתונים שלך')).toBe(true);
    expect(insight.text).toContain('נמוך יותר');
    expect(insight.explanation).toContain(`בדקתי ${DAYS} ימים.`);
    expect(insight.explanation).toContain(`ב-${low.length} ימים ישנת פחות מ-6 שעות.`);
    expect(insight.explanation).toContain((ev.groupAMean as number).toFixed(1));
    expect(insight.explanation).toContain('עוצמת הדפוס: חזק');
    expect(insight.positive).toBeNull();
  });

  it('finds that exercise comes with higher energy', async () => {
    await ensure();
    const insight = byId(report, 'exercise_energy_days');
    expect(insight.category).toBe('exercise_energy');
    expect(insight.strength).toBe('strong');
    const active = planted.days.filter((d) => d.exercise);
    const idle = planted.days.filter((d) => !d.exercise);
    const ev = insight.evidence;
    expect(ev.groupACount).toBe(active.length);
    expect(ev.groupBCount).toBe(idle.length);
    expect(Math.abs((ev.groupAMean as number) - mean(active.map((d) => d.energy)))).toBeLessThanOrEqual(0.051);
    expect(Math.abs((ev.groupBMean as number) - mean(idle.map((d) => d.energy)))).toBeLessThanOrEqual(0.051);
    expect((ev.groupAMean as number) - (ev.groupBMean as number)).toBeGreaterThan(ANALYSIS.strongDiff);
    expect(insight.positive).toBe(true);
    expect(insight.text).toContain('גבוהה יותר');
    expect(insight.explanation).toContain(`ב-${active.length} ימים ביצעת פעילות גופנית.`);
  });

  it('finds the Sunday stress pattern', async () => {
    await ensure();
    const insight = byId(report, 'weekday_stress_0');
    expect(insight.category).toBe('weekday');
    expect(insight.strength).toBe('strong');
    const sundays = planted.days.filter((d) => d.weekday === 0);
    expect(insight.evidence.groupALabel).toBe('ימי ראשון');
    expect(insight.evidence.groupACount).toBe(sundays.length);
    expect(insight.evidence.groupBCount).toBe(DAYS - sundays.length);
    expect(Math.abs((insight.evidence.groupAMean as number) - mean(sundays.map((d) => d.stress)))).toBeLessThanOrEqual(0.051);
    expect(insight.evidence.effectSize as number).toBeGreaterThan(ANALYSIS.strongDiff);
    expect(insight.positive).toBe(false);
    expect(insight.text).toContain('בימי ראשון');
    expect(insight.explanation).toContain(`${sundays.length} ימי ראשון`);
  });

  it('finds that weeks at the reading target come with higher mood', async () => {
    await ensure();
    const insight = byId(report, `habit_mood_${planted.reading}`);
    expect(insight.category).toBe('habit_mood');
    expect(['moderate', 'strong']).toContain(insight.strength);
    const ev = insight.evidence;
    expect(ev.groupACount).toBeGreaterThanOrEqual(ANALYSIS.minGroupSize);
    expect(ev.groupBCount).toBeGreaterThanOrEqual(ANALYSIS.minGroupSize);
    expect((ev.groupAMean as number) - (ev.groupBMean as number)).toBeGreaterThan(ANALYSIS.moderateDiff);
    expect(ev.extra.some((kv) => kv.key === 'יעד שבועי' && kv.value === '4 פעמים בשבוע')).toBe(true);
    expect(insight.text).toContain('"קריאה"');
    expect(insight.explanation).toMatch(/בדקתי \d+ שבועות מלאים/);
    expect(insight.positive).toBe(true);
  });

  it('finds the late-morning window with the highest mood', async () => {
    await ensure();
    const insight = byId(report, 'time_of_day_late_morning');
    expect(insight.category).toBe('time_of_day');
    const midday = planted.days.filter((d) => d.middayMood != null);
    expect(insight.evidence.groupACount).toBe(midday.length);
    expect(Math.abs((insight.evidence.groupAMean as number) - mean(midday.map((d) => d.middayMood as number)))).toBeLessThanOrEqual(0.051);
    expect(insight.evidence.groupAMean as number).toBeGreaterThan(insight.evidence.groupBMean as number);
    expect(insight.text).toContain('בשעות שלפני הצהריים');
    expect(insight.explanation).toContain('לפי שעת הכתיבה');
  });

  it('flags the anomalous day for both mood and stress', async () => {
    await ensure();
    const mood = byId(report, 'anomaly_mood_low');
    expect(mood.category).toBe('anomaly');
    expect(mood.strength).toBe('strong');
    expect(mood.evidence.dates).toContain(planted.anomalyDate);
    expect(mood.evidence.dates[0]).toBe(planted.anomalyDate); // the most extreme day comes first
    expect(mood.positive).toBe(false);
    expect(mood.explanation).toContain(`בדקתי ${DAYS} ימים`);
    expect(mood.explanation).toContain('סטיות תקן');
    const stress = byId(report, 'anomaly_stress_high');
    expect(stress.evidence.dates).toContain(planted.anomalyDate);
    expect(stress.positive).toBe(false);
  });

  it('compares September with August', async () => {
    await ensure();
    const insight = byId(report, 'month_compare_mood');
    expect(insight.category).toBe('month_comparison');
    expect(insight.evidence.groupALabel).toBe('ספטמבר');
    expect(insight.evidence.groupBLabel).toBe('אוגוסט');
    expect(insight.evidence.groupACount).toBe(7);
    expect(insight.evidence.groupBCount).toBe(31);
    const sep = planted.days.filter((d) => d.date >= '2026-09-01');
    const aug = planted.days.filter((d) => d.date >= '2026-08-01' && d.date <= '2026-08-31');
    expect(Math.abs((insight.evidence.groupAMean as number) - mean(sep.map((d) => d.dayMood)))).toBeLessThanOrEqual(0.051);
    expect(Math.abs((insight.evidence.groupBMean as number) - mean(aug.map((d) => d.dayMood)))).toBeLessThanOrEqual(0.051);
    expect(insight.evidence.groupAMean as number).toBeGreaterThan(insight.evidence.groupBMean as number);
    expect(insight.positive).toBe(true);
    expect(insight.text).toContain('בספטמבר');
    expect(insight.text).toContain('באוגוסט');
  });

  it('reports the improving daily habit', async () => {
    await ensure();
    const insight = byId(report, `habit_trend_${planted.water}`);
    expect(insight.category).toBe('habit_improved');
    expect(insight.strength).toBe('strong');
    expect(insight.evidence.groupACount).toBe(13);
    expect(insight.evidence.groupBCount).toBe(4);
    expect(insight.evidence.groupAMean).toBeCloseTo(13 / 14, 2);
    expect(insight.evidence.groupBMean).toBeCloseTo(4 / 14, 2);
    expect(insight.positive).toBe(true);
    expect(insight.text).toContain('"מים"');
    expect(insight.text).toContain('השתפר');
    expect(insight.explanation).toContain('93% לעומת 29%');
  });

  it('reports the writing streak and the habit streak', async () => {
    await ensure();
    const entries = byId(report, 'streak_entries');
    expect(entries.category).toBe('streak');
    expect(entries.strength).toBe('strong');
    expect(entries.evidence.groupACount).toBe(DAYS);
    expect(entries.evidence.dates).toEqual([FIRST, TODAY]);
    expect(entries.positive).toBe(true);
    const water = byId(report, `streak_habit_${planted.water}`);
    expect(water.evidence.groupACount).toBe(7);
    expect(water.strength).toBe('weak');
  });

  it('honours the firstDayOfWeek option without changing the day-level findings', async () => {
    await ensure();
    const monday = generateInsights(db, '3m', TODAY, { firstDayOfWeek: 1 }, 'he');
    expect(monday.insights.some((i) => i.id === 'sleep_mood_lt6')).toBe(true);
    expect(monday.insights.some((i) => i.id === 'weekday_stress_0')).toBe(true);
  });
});

describe('generateInsights on random and sparse data', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not report strong relationships for uniform random data', async () => {
    const db = await DiaryDb.create();
    plantUniform(db);
    const report = generateInsights(db, 'all', TODAY, {}, 'he');
    expect(report.daysWithData).toBe(200);
    expect(report.periodStart).toBe(addDays(TODAY, -199));
    const relationships = report.insights.filter((i) => RELATIONSHIP_CATEGORIES.includes(i.category));
    expect(relationships.every((i) => i.strength !== 'strong')).toBe(true);
    // Uniform 1..10 values never sit 2 standard deviations from the mean.
    expect(report.insights.some((i) => i.category === 'anomaly')).toBe(false);
    expect(report.notes.some((n) => n.includes('ולא מצאתי'))).toBe(true);
    // Descriptive insights (best / hardest days) are legitimate even for random data.
    expect(report.insights.some((i) => i.category === 'best_days')).toBe(true);
    expect(report.insights.some((i) => i.category === 'hard_days')).toBe(true);
    for (const insight of report.insights) {
      expect(STRENGTHS).toContain(insight.strength);
      expect(insight.text).not.toMatch(CAUSAL);
    }
    db.close();
  });

  it('explains that five days are not enough and reports no relationships', async () => {
    const db = await DiaryDb.create();
    for (let i = 0; i < 5; i++) {
      insertEntry(db, {
        date: addDays(TODAY, -i),
        time: '21:00',
        title: `יום ${i}`,
        body: 'קצר.',
        mood: 5 + i,
        energy: 6,
        stress: 3,
        sleepHours: 7,
        exerciseMinutes: i % 2 ? 30 : 0,
        emotions: ['calm'],
      });
    }
    const report = generateInsights(db, '30d', TODAY, {}, 'he');
    expect(report.daysWithData).toBe(5);
    expect(report.notes.length).toBeGreaterThanOrEqual(5);
    expect(report.notes.some((n) => n.includes('אין מספיק נתונים') && n.includes('שינה למצב רוח') && n.includes('14 ימים'))).toBe(true);
    expect(report.notes.some((n) => n.includes('פעילות גופנית'))).toBe(true);
    expect(report.notes.some((n) => n.includes('ימי השבוע'))).toBe(true);
    expect(report.notes.every((n) => HEBREW.test(n))).toBe(true);
    // Only the writing streak is reportable on five days.
    expect(report.insights.every((i) => i.category === 'streak')).toBe(true);
    expect(report.insights.some((i) => i.id === 'streak_entries')).toBe(true);
    db.close();
  });

  it('returns an empty report with notes for an empty diary', async () => {
    const db = await DiaryDb.create();
    const report = generateInsights(db, '30d', TODAY, {}, 'he');
    expect(report.insights).toEqual([]);
    expect(report.daysWithData).toBe(0);
    expect(report.periodStart).toBe(addDays(TODAY, -29));
    expect(report.notes.length).toBeGreaterThan(0);
    expect(report.notes.every((n) => HEBREW.test(n))).toBe(true);
    db.close();
  });

  it('isolates a throwing detector: a note is added and the other detectors still run', async () => {
    const db = await DiaryDb.create();
    plantDiary(db);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom: Detector = {
      id: 'boom',
      label: () => 'בדיקה שנכשלת',
      detect: () => {
        throw new Error('detector exploded');
      },
    };
    const provider = new RulesProvider([boom, sleepMoodDetector]);
    const report = generateInsights(db, '3m', TODAY, { provider }, 'he');
    expect(report.provider).toBe('rules-v1');
    expect(report.notes).toContain('הבדיקה "בדיקה שנכשלת" לא הושלמה (שגיאה פנימית); שאר התובנות תקינות.');
    expect(report.insights.map((i) => i.id)).toEqual(['sleep_mood_lt6']);
    expect(errorSpy).toHaveBeenCalled();
    // The failure message never reaches the user-facing notes.
    expect(report.notes.join(' ')).not.toContain('detector exploded');
    db.close();
  });

  it('survives a provider that throws outright', async () => {
    const db = await DiaryDb.create();
    plantDiary(db);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: AnalysisProvider = {
      name: 'broken-model',
      analyze: () => {
        throw new Error('model crashed');
      },
    };
    const report = generateInsights(db, '30d', TODAY, { provider: broken }, 'he');
    expect(report.provider).toBe('broken-model');
    expect(report.insights).toEqual([]);
    expect(report.notes.some((n) => n.includes('ניתוח הדפוסים לא הושלם'))).toBe(true);
    expect(report.notes.join(' ')).not.toContain('model crashed');
    db.close();
  });
});
