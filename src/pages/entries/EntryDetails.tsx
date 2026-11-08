/**
 * Full read view of one entry, shared by EntryPage and DayPage: a definition
 * list for the numbers, emotions as badges, events / people lists, the body and
 * notes with preserved line breaks, and tags as links to the filtered timeline.
 * `headingLevel` sets the level of the section headings so the component fits
 * under an h1 (entry page) or under an h3 (day page).
 */
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { emotionLabel } from '@shared/constants';
import type { Entry } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { DefinitionList, type DefinitionItem } from '@/components/ui/DefinitionList';
import { cx } from '@/components/ui/cx';
import { PATHS } from '@/constants/routes';
import { getCurrentLocale } from '@/i18n/runtime';
import { formatHours, formatMinutes, ratingText } from '@/utils/format';
import { ET } from './texts';

export interface EntryDetailsProps {
  entry: Entry;
  /** Level of the section headings (default h2). */
  headingLevel?: 'h2' | 'h3' | 'h4';
  className?: string;
}

/** "30 minutes (walking)" / "No exercise" / "walking" / null when nothing was reported. */
export function exerciseText(minutes: number | null, type: string): string | null {
  const kind = type.trim();
  if (minutes === null) return kind || null;
  const duration = minutes === 0 ? ET.noExercise : formatMinutes(minutes);
  return kind ? ET.exerciseWithType(duration, kind) : duration;
}

/**
 * Link to the timeline filtered by a tag. With `date` (the entry's day) the
 * timeline opens on the period that contains it, so the entry the tag was
 * clicked on is among the results instead of the current week's.
 */
export function tagLink(tag: string, date?: string): { pathname: string; search: string } {
  const params = new URLSearchParams({ tag });
  if (date) params.set('date', date);
  return { pathname: PATHS.diary, search: `?${params.toString()}` };
}

export function EntryDetails({ entry, headingLevel: Heading = 'h2', className }: EntryDetailsProps) {
  const base = useId();
  const hid = (name: string) => `entry-details-${base}-${name}`;

  const metrics: DefinitionItem[] = [
    { term: ET.mood, value: ratingText(entry.mood) },
    { term: ET.energy, value: ratingText(entry.energy) },
    { term: ET.stress, value: ratingText(entry.stress) },
    { term: ET.sleepQuality, value: ratingText(entry.sleepQuality) },
    { term: ET.sleepHours, value: formatHours(entry.sleepHours) },
    { term: ET.exercise, value: exerciseText(entry.exerciseMinutes, entry.exerciseType) },
    { term: ET.location, value: entry.location.trim() || null },
  ];

  const preWrap = { whiteSpace: 'pre-wrap' as const };

  return (
    <div className={cx('entry-details', className)}>
      <section aria-labelledby={hid('metrics')}>
        <Heading id={hid('metrics')} className="entry-details__heading">
          {ET.detailsHeading}
        </Heading>
        <DefinitionList items={metrics} aria-label={ET.detailsHeading} />
      </section>

      <section aria-labelledby={hid('emotions')}>
        <Heading id={hid('emotions')} className="entry-details__heading">
          {ET.emotionsHeading}
        </Heading>
        {entry.emotions.length > 0 ? (
          <ul className="chips" aria-label={ET.emotions}>
            {entry.emotions.map((key) => (
              <li key={key}>
                <Badge>{emotionLabel(key, getCurrentLocale())}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{ET.noEmotions}</p>
        )}
      </section>

      {entry.events.length > 0 && (
        <section aria-labelledby={hid('events')}>
          <Heading id={hid('events')} className="entry-details__heading">
            {ET.eventsHeading}
          </Heading>
          <ul className="plain-list">
            {entry.events.map((item) => (
              <li key={item}>
                <bdi>{item}</bdi>
              </li>
            ))}
          </ul>
        </section>
      )}

      {entry.people.length > 0 && (
        <section aria-labelledby={hid('people')}>
          <Heading id={hid('people')} className="entry-details__heading">
            {ET.peopleHeading}
          </Heading>
          <ul className="plain-list">
            {entry.people.map((item) => (
              <li key={item}>
                <bdi>{item}</bdi>
              </li>
            ))}
          </ul>
        </section>
      )}

      {entry.body.trim() && (
        <section aria-labelledby={hid('body')}>
          <Heading id={hid('body')} className="entry-details__heading">
            {ET.bodyHeading}
          </Heading>
          <div className="entry-body user-text" style={preWrap} data-testid="entry-body" dir="auto">
            {entry.body}
          </div>
        </section>
      )}

      {entry.notes.trim() && (
        <section aria-labelledby={hid('notes')}>
          <Heading id={hid('notes')} className="entry-details__heading">
            {ET.notesHeading}
          </Heading>
          <div className="entry-body user-text" style={preWrap} data-testid="entry-notes" dir="auto">
            {entry.notes}
          </div>
        </section>
      )}

      <section aria-labelledby={hid('tags')}>
        <Heading id={hid('tags')} className="entry-details__heading">
          {ET.tagsHeading}
        </Heading>
        {entry.tags.length > 0 ? (
          <ul className="chips" aria-label={ET.tags}>
            {entry.tags.map((tag) => (
              <li className="chip" key={tag}>
                <Link to={tagLink(tag, entry.date)}>
                  #<bdi>{tag}</bdi>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{ET.noTags}</p>
        )}
      </section>
    </div>
  );
}
