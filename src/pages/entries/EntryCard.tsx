/**
 * Timeline item for one entry summary: time, title, metric badges, emotions,
 * excerpt and an "open" link whose accessible name includes the title.
 */
import { Link } from 'react-router-dom';
import { emotionLabel } from '@shared/constants';
import type { EntrySummary } from '@shared/types';
import { PendingBadge } from '@/components/sync/PendingBadge';
import { cx } from '@/components/ui/cx';
import { PATHS } from '@/constants/routes';
import { getCurrentLocale } from '@/i18n/runtime';
import { formatClock, formatShortDate } from '@/utils/dates';
import { MetricBadges } from './MetricBadges';
import { ET } from './texts';

export interface EntryCardProps {
  entry: EntrySummary;
  /** Heading element for the title (default h4: the timeline's day heading is an h3). */
  headingLevel?: 'h3' | 'h4';
  /** Show the date next to the time (for lists that are not grouped by day). */
  showDate?: boolean;
  className?: string;
}

/** Title shown for an entry (falls back to ET.untitled, "Untitled entry"). */
export function entryTitle(title: string | null | undefined): string {
  const trimmed = (title ?? '').trim();
  return trimmed || ET.untitled;
}

export function EntryCard({ entry, headingLevel: Heading = 'h4', showDate = false, className }: EntryCardProps) {
  const titleId = `entry-card-${entry.id}-title`;
  const title = entryTitle(entry.title);
  return (
    <article className={cx('card', 'entry-card', className)} aria-labelledby={titleId}>
      <div className="entry-card__header">
        <time className="entry-card__time" dateTime={`${entry.date}T${entry.time}`}>
          {showDate ? ET.cardDateTime(formatShortDate(entry.date), formatClock(entry.time)) : formatClock(entry.time)}
        </time>
        <Heading id={titleId} className="entry-card__title">
          <bdi>{title}</bdi>
        </Heading>
        {/* Offline mode: "Not uploaded yet" / "Needs attention" (nothing while offline mode is off). */}
        <PendingBadge kind="entry" id={entry.id} record={entry} />
      </div>
      <MetricBadges mood={entry.mood} energy={entry.energy} stress={entry.stress} sleepHours={entry.sleepHours} />
      {entry.emotions.length > 0 && (
        <ul className="chips entry-card__emotions" aria-label={ET.emotions}>
          {entry.emotions.map((key) => (
            <li className="chip" key={key}>
              {emotionLabel(key, getCurrentLocale())}
            </li>
          ))}
        </ul>
      )}
      {entry.excerpt && (
        <p className="entry-card__excerpt user-text" dir="auto">
          {entry.excerpt}
        </p>
      )}
      <div className="entry-card__footer">
        <Link to={PATHS.entry(entry.id)} className="btn btn--secondary btn--sm" aria-label={ET.openNamed(title)}>
          {ET.open}
        </Link>
      </div>
    </article>
  );
}
