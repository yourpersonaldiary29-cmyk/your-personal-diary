/**
 * Compact badges for an entry's numbers: "מצב רוח 7", "אנרגיה 6", "לחץ 3",
 * "שינה 7.5 שעות". Null values are simply omitted (never shown as 0); when
 * nothing was reported the component renders nothing.
 */
import { Badge } from '@/components/ui/Badge';
import { cx } from '@/components/ui/cx';
import { formatHours, formatNumber } from '@/utils/format';
import { ET } from './texts';

export interface MetricBadgesProps {
  mood?: number | null;
  energy?: number | null;
  stress?: number | null;
  sleepHours?: number | null;
  className?: string;
  /** Accessible name of the list, default ET.metricsLabel ("Metrics"). */
  'aria-label'?: string;
}

export interface MetricBadgeItem {
  key: 'mood' | 'energy' | 'stress' | 'sleepHours';
  text: string;
}

/** The badge texts for the given values (nulls skipped). Exported for tests. */
export function metricBadgeItems(values: Pick<MetricBadgesProps, 'mood' | 'energy' | 'stress' | 'sleepHours'>): MetricBadgeItem[] {
  const items: MetricBadgeItem[] = [];
  if (values.mood !== null && values.mood !== undefined) items.push({ key: 'mood', text: ET.moodBadge(formatNumber(values.mood)) });
  if (values.energy !== null && values.energy !== undefined) items.push({ key: 'energy', text: ET.energyBadge(formatNumber(values.energy)) });
  if (values.stress !== null && values.stress !== undefined) items.push({ key: 'stress', text: ET.stressBadge(formatNumber(values.stress)) });
  if (values.sleepHours !== null && values.sleepHours !== undefined) {
    items.push({ key: 'sleepHours', text: ET.sleepBadge(formatHours(values.sleepHours)) });
  }
  return items;
}

export function MetricBadges({ mood, energy, stress, sleepHours, className, 'aria-label': label }: MetricBadgesProps) {
  const items = metricBadgeItems({ mood, energy, stress, sleepHours });
  if (items.length === 0) return null;
  return (
    <ul className={cx('metric-badges', className)} aria-label={label ?? ET.metricsLabel}>
      {items.map((item) => (
        <li key={item.key}>
          <Badge kind="primary">{item.text}</Badge>
        </li>
      ))}
    </ul>
  );
}
