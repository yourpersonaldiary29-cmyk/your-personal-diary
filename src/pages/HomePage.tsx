/**
 * Home page (authenticated): greeting + today's date, a "New entry" button,
 * today's summary (entries, writing streak), this week's averages as text
 * tiles, today's habits with quick logging, the top insight and the last entry.
 * Everything comes from one call: GET /api/home. Texts: 'insights.home.*'.
 */
import { Link } from 'react-router-dom';
import type { HomeSummary } from '@shared/types';
import * as api from '@/api';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageTitle } from '@/components/ui/PageTitle';
import { Spinner } from '@/components/ui/Spinner';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAuth } from '@/context/AuthContext';
import { PartialViewHint } from '@/components/sync/PartialViewHint';
import { useApi } from '@/hooks/useApi';
import { tr } from '@/i18n/runtime';
import { formatDateTime, formatHebrewDate, todayIso } from '@/utils/dates';
import { formatDecimal, ratingText } from '@/utils/format';
import { STRENGTH_LABELS } from './insights/insight-groups';
import { HabitQuickLog } from './habits/HabitQuickLog';

export const HOME_TEXTS = {
  get title() {
    return tr('insights.home.title');
  },
  get newEntry() {
    return tr('insights.home.newEntry');
  },
  get greetingLabel() {
    return tr('insights.home.greetingLabel');
  },
  get today() {
    return tr('insights.home.today');
  },
  get weekAverages() {
    return tr('insights.home.weekAverages');
  },
  get habitsToday() {
    return tr('insights.home.habitsToday');
  },
  get insightOfDay() {
    return tr('insights.home.insightOfDay');
  },
  get lastEntry() {
    return tr('insights.home.lastEntry');
  },
  get noData() {
    return tr('insights.home.noData');
  },
  get noHabits() {
    return tr('insights.home.noHabits');
  },
  get manageHabits() {
    return tr('insights.home.manageHabits');
  },
  get allHabits() {
    return tr('insights.home.allHabits');
  },
  get allInsights() {
    return tr('insights.home.allInsights');
  },
  get noInsight() {
    return tr('insights.home.noInsight');
  },
  get noEntriesTitle() {
    return tr('insights.home.noEntriesTitle');
  },
  get noEntriesText() {
    return tr('insights.home.noEntriesText');
  },
  get firstEntry() {
    return tr('insights.home.firstEntry');
  },
  get untitled() {
    return tr('insights.home.untitled');
  },
  streak: (days: number) => tr('insights.home.streak', { count: days }),
  entriesToday: (n: number) => tr('insights.home.entriesToday', { count: n }),
  totalEntries: (n: number) => tr('insights.home.totalEntries', { count: n }),
  /** "7.2 of 10" for a week average. */
  ratingOf10: (value: number) => tr('insights.home.ratingOf10', { value: formatDecimal(value) }),
  /** "6.8 hours" for the week's sleep average. */
  sleepHours: (value: number) => tr('insights.home.sleepHours', { value: formatDecimal(value) }),
  lastEntryMood: (mood: number | null) => tr('insights.home.lastEntryMood', { value: ratingText(mood) }),
} as const;

interface Tile {
  label: string;
  value: string;
}

function weekTiles(data: HomeSummary): Tile[] {
  const rating = (v: number | null) => (v === null ? HOME_TEXTS.noData : HOME_TEXTS.ratingOf10(v));
  return [
    { label: tr('stats.metric.mood'), value: rating(data.weekMoodAvg) },
    { label: tr('stats.metric.energy'), value: rating(data.weekEnergyAvg) },
    { label: tr('stats.metric.stress'), value: rating(data.weekStressAvg) },
    { label: tr('stats.metric.sleepHours'), value: data.weekSleepAvg === null ? HOME_TEXTS.noData : HOME_TEXTS.sleepHours(data.weekSleepAvg) },
  ];
}

export default function HomePage() {
  const { user } = useAuth();
  const firstName = user?.firstName ?? '';
  const { data, loading, error, reload } = useApi(() => api.insights.home(), [], { offline: true });
  const today = data?.today ?? todayIso();

  return (
    <div className="stack">
      <PageTitle title={HOME_TEXTS.title} actions={<LinkButton to={PATHS.newEntry}>{HOME_TEXTS.newEntry}</LinkButton>} />

      <Card highlight aria-label={HOME_TEXTS.greetingLabel}>
        <p>
          <strong>{T.greetingShort(firstName)}</strong>
        </p>
        <p>{formatHebrewDate(today)}</p>
      </Card>

      {loading && !data && <Spinner block size="lg" />}
      {error && (
        <Alert kind="error">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            {T.retry}
          </Button>
        </Alert>
      )}

      <PartialViewHint value={data} />
      {data && (
        <>
          <div className="grid-2">
            <Card title={HOME_TEXTS.today}>
              <p>{HOME_TEXTS.entriesToday(data.todayEntryCount)}</p>
              <p>{HOME_TEXTS.streak(data.entryStreak)}</p>
              <p className="text-muted text-small">{HOME_TEXTS.totalEntries(data.totalEntries)}</p>
            </Card>

            <Card title={HOME_TEXTS.weekAverages}>
              <ul className="grid-2" aria-label={HOME_TEXTS.weekAverages}>
                {weekTiles(data).map((tile) => (
                  <li key={tile.label} className="card">
                    <span className="text-muted">{tile.label}</span>
                    <br />
                    <strong>{tile.value}</strong>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card title={HOME_TEXTS.habitsToday} actions={<Link to={PATHS.habits}>{HOME_TEXTS.allHabits}</Link>}>
            {data.habitsToday.length === 0 ? (
              <p>
                {HOME_TEXTS.noHabits} <Link to={PATHS.habits}>{HOME_TEXTS.manageHabits}</Link>
              </p>
            ) : (
              <ul className="stack">
                {data.habitsToday.map((item) => (
                  <li key={item.habit.id}>
                    <article aria-labelledby={`home-habit-${item.habit.id}-name`} className="stack-sm">
                      <h3 id={`home-habit-${item.habit.id}-name`}>{item.habit.name}</h3>
                      <HabitQuickLog item={item} date={data.today} onChanged={reload} idPrefix={`home-habit-${item.habit.id}`} />
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid-2">
            <Card title={HOME_TEXTS.insightOfDay} actions={<Link to={PATHS.insights}>{HOME_TEXTS.allInsights}</Link>}>
              {data.topInsight ? (
                <article aria-labelledby="home-insight-title" className="stack-sm">
                  <Badge kind={data.topInsight.strength === 'strong' ? 'primary' : 'default'}>{STRENGTH_LABELS[data.topInsight.strength]}</Badge>
                  <h3 id="home-insight-title">{data.topInsight.title}</h3>
                  <p>{data.topInsight.text}</p>
                </article>
              ) : (
                <p>{HOME_TEXTS.noInsight}</p>
              )}
            </Card>

            <Card title={HOME_TEXTS.lastEntry}>
              {data.lastEntry ? (
                <article aria-labelledby="home-last-entry-title" className="stack-sm">
                  <h3 id="home-last-entry-title">
                    <Link to={PATHS.entry(data.lastEntry.id)}>
                      <bdi>{data.lastEntry.title.trim() || HOME_TEXTS.untitled}</bdi>
                    </Link>
                  </h3>
                  <p className="text-muted text-small">{formatDateTime(data.lastEntry.date, data.lastEntry.time)}</p>
                  {/* The user's own text may be in another script than the UI (Hebrew entry, English UI): own direction. */}
                  {data.lastEntry.excerpt && (
                    <p className="user-text" dir="auto">
                      {data.lastEntry.excerpt}
                    </p>
                  )}
                  <p className="text-small">{HOME_TEXTS.lastEntryMood(data.lastEntry.mood)}</p>
                </article>
              ) : (
                <EmptyState
                  headingLevel="h3"
                  title={HOME_TEXTS.noEntriesTitle}
                  text={HOME_TEXTS.noEntriesText}
                  action={
                    <LinkButton to={PATHS.newEntry} variant="secondary">
                      {HOME_TEXTS.firstEntry}
                    </LinkButton>
                  }
                />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
