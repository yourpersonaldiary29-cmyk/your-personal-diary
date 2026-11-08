/**
 * Grouping of insight categories into the sections shown on the insights page,
 * plus the strength / direction labels. Pure module (no React). Every label is
 * a getter that resolves through the current UI language, so `group.title`
 * and `STRENGTH_LABELS.strong` always read in the language of the moment.
 */
import type { Insight, InsightCategory, InsightStrength } from '@shared/types';
import { tr } from '@/i18n/runtime';

export interface InsightGroupDef {
  id: string;
  /** Section heading in the current language. */
  readonly title: string;
  categories: InsightCategory[];
}

export const INSIGHT_GROUPS: InsightGroupDef[] = [
  {
    id: 'trends',
    get title() {
      return tr('insights.group.trends');
    },
    categories: ['weekly_trend', 'monthly_trend', 'mood_change', 'stress_change', 'sleep_change', 'month_comparison'],
  },
  {
    id: 'habits',
    get title() {
      return tr('insights.group.habits');
    },
    // 'correlation' = a habit's link to energy or stress (the habit-mood detector's quiet
    // outcomes), so it belongs with the habits - never under "Anomalies" (unusual days).
    categories: ['habit_improved', 'habit_declined', 'habit_mood', 'correlation', 'streak'],
  },
  {
    id: 'sleep-activity',
    get title() {
      return tr('insights.group.sleepActivity');
    },
    categories: ['sleep_mood', 'sleep_energy', 'exercise_energy', 'exercise_mood'],
  },
  {
    id: 'days-hours',
    get title() {
      return tr('insights.group.daysHours');
    },
    categories: ['weekday', 'time_of_day', 'best_days', 'hard_days'],
  },
  {
    id: 'emotions-people',
    get title() {
      return tr('insights.group.emotionsPeople');
    },
    categories: ['emotion_pattern', 'people_places'],
  },
  {
    id: 'anomalies',
    get title() {
      return tr('insights.group.anomalies');
    },
    categories: ['anomaly'],
  },
];

/** Catch-all for categories a newer server might add. */
export const OTHER_GROUP: InsightGroupDef = {
  id: 'other',
  get title() {
    return tr('insights.group.other');
  },
  categories: [],
};

/** "Strong pattern" / "Moderate pattern" / "Weak pattern" in the current language. */
export const STRENGTH_LABELS: Record<InsightStrength, string> = {
  get strong() {
    return tr('insights.strength.strong');
  },
  get moderate() {
    return tr('insights.strength.moderate');
  },
  get weak() {
    return tr('insights.strength.weak');
  },
};

/** Direction badges: "Encouraging" / "Worth attention". */
export const DIRECTION_LABELS = {
  get positive() {
    return tr('insights.positive');
  },
  get attention() {
    return tr('insights.attention');
  },
} as const;

export interface InsightGroup {
  group: InsightGroupDef;
  insights: Insight[];
}

/**
 * Splits the insights into the display groups (in INSIGHT_GROUPS order, empty
 * groups omitted). Inside a group the insights are ordered by score, highest first.
 */
export function groupInsights(insights: Insight[]): InsightGroup[] {
  const byCategory = new Map<InsightCategory, InsightGroupDef>();
  for (const group of INSIGHT_GROUPS) for (const c of group.categories) byCategory.set(c, group);

  const buckets = new Map<string, InsightGroup>();
  for (const group of [...INSIGHT_GROUPS, OTHER_GROUP]) buckets.set(group.id, { group, insights: [] });
  for (const insight of insights) {
    const group = byCategory.get(insight.category) ?? OTHER_GROUP;
    buckets.get(group.id)?.insights.push(insight);
  }

  const out: InsightGroup[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.insights.length === 0) continue;
    bucket.insights.sort((a, b) => b.score - a.score);
    out.push(bucket);
  }
  return out;
}
