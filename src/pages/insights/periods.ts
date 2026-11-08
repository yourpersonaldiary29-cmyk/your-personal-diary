/**
 * Localised period labels for the period pickers of the insights and
 * statistics pages ('stats.period.*' keys). Pure module (no React).
 *
 *   periodLabelText('30d')   -> '30 days' / '30 ימים'
 *   inPeriodText('30d')      -> 'in the last 30 days' / 'ב-30 ימים'
 *   periodOptions()          -> options for <Select> in the current language
 */
import type { Period } from '@shared/types';
import { PERIODS } from '@shared/constants';
import type { SelectOption } from '@/components/ui/Select';
import { tr } from '@/i18n/runtime';

/** Label of a period in the current language ("30 days"). */
export function periodLabelText(period: Period): string {
  return tr(`stats.period.${period}`);
}

/** The period as an adverbial phrase ("in the last 30 days") for sentences. */
export function inPeriodText(period: Period): string {
  return tr('stats.period.in', { period });
}

/** Select options for every period, in the current language (build per render). */
export function periodOptions(): SelectOption<Period>[] {
  return PERIODS.map((p) => ({ value: p.value, label: periodLabelText(p.value) }));
}
