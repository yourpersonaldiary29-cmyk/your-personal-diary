/**
 * Statistics page: GET /api/stats?period=… rendered as accessible charts.
 * Rating metrics (mood, energy, stress, sleep quality) and sleep hours are
 * line charts with the 7-day moving average as a dashed second series;
 * exercise minutes and entries per day are bar charts; weekday means are a
 * grouped bar chart; every habit gets a bar chart of its daily values.
 * Every chart carries a text summary and a "Show as table" toggle.
 * Texts: 'stats.*'.
 */
import { useRef, useState } from 'react';
import type { HabitStats, Period, SeriesPoint, StatsOverview, StatsSeries } from '@shared/types';
import * as api from '@/api';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { defaultXLabel, withUnit, type ChartPoint, type ChartSeries } from '@/components/charts/chart-utils';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { NeedsConnectionPage } from '@/components/sync/NeedsConnection';
import { useOfflineNow } from '@/components/sync/hooks';
import { PageTitle } from '@/components/ui/PageTitle';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { PATHS } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useSettings } from '@/context/SettingsContext';
import { useApi } from '@/hooks/useApi';
import { tr } from '@/i18n/runtime';
import { formatShortDate, isValidIsoDate, localizedWeekdayNames, localizedWeekdayShort } from '@/utils/dates';
import { formatDays, formatDecimal, formatNumber, formatPercent, formatSigned } from '@/utils/format';
import { formatWeeks } from './habits/habit-text';
import { periodOptions } from './insights/periods';

export type SectionKey = 'mood' | 'energy' | 'stress' | 'sleepHours' | 'sleepQuality' | 'exerciseMinutes' | 'entriesPerDay';

export const STATS_TEXTS = {
  get title() {
    return tr('stats.title');
  },
  get period() {
    return tr('stats.period');
  },
  get movingAvg() {
    return tr('stats.movingAvg');
  },
  overTime: (label: string) => tr('stats.overTime', { label }),
  get weekdaySection() {
    return tr('stats.weekday.section');
  },
  get weekdayChart() {
    return tr('stats.weekday.chart');
  },
  get weekdayAxis() {
    return tr('stats.weekday.axis');
  },
  get habitsSection() {
    return tr('stats.habits.section');
  },
  habitChart: (name: string) => tr('stats.habits.chart', { name }),
  get noHabits() {
    return tr('stats.habits.empty');
  },
  get emptyTitle() {
    return tr('stats.empty.title');
  },
  get emptyText() {
    return tr('stats.empty.text');
  },
  get newEntry() {
    return tr('stats.newEntry');
  },
  get noValues() {
    return tr('stats.noValues');
  },
  /** Section / metric title ("Mood", "Sleep hours"...). */
  metric: (key: SectionKey) => tr(`stats.metric.${key}`),
  /** "5 entries on 4 days (25/08/2026 – 23/09/2026)". */
  overview: (o: StatsOverview) =>
    tr('stats.overview', { entries: o.totalEntries, days: o.daysWithEntries, from: formatShortDate(o.from), to: formatShortDate(o.to) }),
} as const;

interface SectionDef {
  key: SectionKey;
  /** Section heading in the current language. */
  readonly title: string;
  kind: 'line' | 'bar';
  yMin?: number;
  yMax?: number;
  decimals?: number;
}

const RATING = { yMin: 1, yMax: 10 };

function section(key: SectionKey, rest: Omit<SectionDef, 'key' | 'title'>): SectionDef {
  return {
    key,
    get title() {
      return STATS_TEXTS.metric(key);
    },
    ...rest,
  };
}

export const SECTIONS: SectionDef[] = [
  section('mood', { kind: 'line', ...RATING }),
  section('energy', { kind: 'line', ...RATING }),
  section('stress', { kind: 'line', ...RATING }),
  section('sleepHours', { kind: 'line', yMin: 0 }),
  section('sleepQuality', { kind: 'line', ...RATING }),
  section('exerciseMinutes', { kind: 'bar', yMin: 0, decimals: 0 }),
  section('entriesPerDay', { kind: 'bar', yMin: 0, decimals: 0 }),
];

function toPoints(points: SeriesPoint[]): ChartPoint[] {
  return points.map((p) => ({ x: p.date, y: p.value }));
}

/** Main series plus the moving average (dashed, square markers) when it has values. */
export function chartSeries(series: StatsSeries): ChartSeries[] {
  const out: ChartSeries[] = [{ label: series.label, points: toPoints(series.points), shape: 'circle', dash: '' }];
  if (series.movingAvg.some((p) => p.value !== null)) {
    out.push({ label: STATS_TEXTS.movingAvg, points: toPoints(series.movingAvg), shape: 'square', dash: '7 4' });
  }
  return out;
}

/** Summary sentence: mean, count, min/max and the comparison with the previous period. */
export function seriesSummary(series: StatsSeries, chartDecimals = 1): string {
  if (series.count === 0 || series.mean === null) return STATS_TEXTS.noValues;
  const isCount = series.metric === 'entries';
  // Whole entries per day on the chart, but the mean of a 0-2 count needs a decimal ("1.2", not "1").
  const decimals = isCount ? Math.max(chartDecimals, 1) : chartDecimals;
  // The entries series is a count per day: say "entries per day" instead of "1 entries".
  const unit = isCount ? tr('stats.summary.entriesPerDay') : series.unit || undefined;
  const extreme = (v: number | null) => (isCount ? formatNumber(v) : withUnit(formatNumber(v), unit));
  const sample = tr(isCount ? 'stats.summary.sampleDays' : 'stats.summary.sampleValues', { count: series.count });
  const summary = tr('stats.summary.base', {
    mean: withUnit(formatDecimal(series.mean, decimals), unit),
    sample,
    min: extreme(series.min),
    max: extreme(series.max),
  });
  if (series.previousMean === null) return summary;
  const diff = series.mean - series.previousMean;
  const previous = withUnit(formatDecimal(series.previousMean, decimals), unit);
  // "No change" whenever the difference rounds to zero at the shown precision (never "+0").
  const comparison =
    Math.abs(diff) < 0.5 * 10 ** -decimals
      ? tr('stats.summary.noChange', { previous })
      : tr('stats.summary.change', { previous, diff: formatSigned(diff, decimals) });
  return tr('stats.summary.sentences', { summary, comparison });
}

/** Short weekday name under the bars ("Wed"); the table and tooltips keep the full name. */
function weekdayTick(name: string): string {
  const i = localizedWeekdayNames().indexOf(name);
  return i < 0 ? name : localizedWeekdayShort()[i];
}

/**
 * Date formatting for the charts of a period: the axis always shows day and month; when the
 * period crosses a new year (1 year, all time) the table, tooltips and range sentence add the
 * year, so "01/10" of two different years cannot be confused.
 */
export function dateFormatters(o: Pick<StatsOverview, 'from' | 'to'>): { xLabelFormatter?: (x: string) => string; xTickFormatter?: (x: string) => string } {
  if (o.from.slice(0, 4) === o.to.slice(0, 4)) return {};
  return { xLabelFormatter: (x) => (isValidIsoDate(x) ? formatShortDate(x) : x), xTickFormatter: defaultXLabel };
}

function weekdaySeries(o: StatsOverview): ChartSeries[] {
  const names = localizedWeekdayNames();
  const build = (label: string, values: (number | null)[]): ChartSeries => ({
    label,
    points: names.map((name, i) => ({ x: name, y: values[i] ?? null })),
  });
  return [build(STATS_TEXTS.metric('mood'), o.weekdayMood), build(STATS_TEXTS.metric('energy'), o.weekdayEnergy), build(STATS_TEXTS.metric('stress'), o.weekdayStress)];
}

/** "Completion: 70% (21 of 30 days), current streak: 5 days, best: 12 days". */
export function habitSummary(h: HabitStats): string {
  const fmt = h.frequency === 'weekly' ? formatWeeks : formatDays;
  return tr('stats.habits.summary', {
    percent: formatPercent(h.completionRate),
    completed: formatNumber(h.completedDays),
    total: h.totalDays,
    frequency: h.frequency,
    current: fmt(h.currentStreak),
    best: fmt(h.bestStreak),
  });
}

/**
 * Online only (docs/android-tasks/OFFLINE-DESIGN.md section 6.2): while the automatic offline mode runs
 * without a connection the page says "This needs a connection to the diary server." [Try again];
 * otherwise (and always while offline mode is off) it is the page as it was.
 */
export default function StatsPage() {
  const offlineNow = useOfflineNow();
  if (offlineNow) return <NeedsConnectionPage title={STATS_TEXTS.title} />;
  return <StatsPageContent />;
}

function StatsPageContent() {
  const { settings } = useSettings();
  const { announce } = useAnnouncer();
  const [period, setPeriod] = useState<Period>(settings.defaultPeriod);
  // After the user picks another period the new totals are announced: the charts update
  // silently, so a screen reader would otherwise hear nothing after the select changes.
  const periodPicked = useRef(false);
  const { data, loading, error, reload } = useApi(() => api.stats.overview(period), [period], {
    onSuccess: (overview) => {
      if (periodPicked.current) announce(STATS_TEXTS.overview(overview), 'polite');
    },
  });
  const isEmpty = data !== null && data.totalEntries === 0 && data.habits.length === 0;

  return (
    <div className="stack">
      <PageTitle title={STATS_TEXTS.title} subtitle={data ? STATS_TEXTS.overview(data) : undefined} />
      <div className="cluster">
        <Select<Period>
          id="stats-period"
          label={STATS_TEXTS.period}
          options={periodOptions()}
          value={period}
          onChange={(next) => {
            periodPicked.current = true;
            setPeriod(next);
          }}
        />
      </div>

      {loading && !data && <Spinner block size="lg" />}
      {error && (
        <Alert kind="error">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            {T.retry}
          </Button>
        </Alert>
      )}

      {isEmpty && <EmptyState title={STATS_TEXTS.emptyTitle} text={STATS_TEXTS.emptyText} action={<LinkButton to={PATHS.newEntry}>{STATS_TEXTS.newEntry}</LinkButton>} />}

      {data && !isEmpty && (
        <div className="stack" aria-busy={loading || undefined}>
          {SECTIONS.map((def) => {
            const series = data[def.key];
            const title = STATS_TEXTS.overTime(def.title);
            const decimals = def.decimals ?? 1;
            const common = { title, series: chartSeries(series), unit: series.unit || undefined, yMin: def.yMin, yMax: def.yMax, decimals, ...dateFormatters(data) };
            return (
              <section key={def.key} aria-labelledby={`stats-${def.key}`} className="card stack-sm">
                <h2 id={`stats-${def.key}`}>{def.title}</h2>
                <p>{seriesSummary(series, decimals)}</p>
                {def.kind === 'line' ? <LineChart {...common} /> : <BarChart {...common} />}
              </section>
            );
          })}

          <section aria-labelledby="stats-weekday" className="card stack-sm">
            <h2 id="stats-weekday">{STATS_TEXTS.weekdaySection}</h2>
            <BarChart
              title={STATS_TEXTS.weekdayChart}
              series={weekdaySeries(data)}
              yMin={1}
              yMax={10}
              xAxisLabel={STATS_TEXTS.weekdayAxis}
              xLabelFormatter={(x) => x}
              xTickFormatter={weekdayTick}
            />
          </section>

          <section aria-labelledby="stats-habits" className="stack">
            <h2 id="stats-habits">{STATS_TEXTS.habitsSection}</h2>
            {data.habits.length === 0 && <p>{STATS_TEXTS.noHabits}</p>}
            {data.habits.map((h) => (
              <article key={h.habitId} aria-labelledby={`stats-habit-${h.habitId}`} className="card stack-sm">
                <h3 id={`stats-habit-${h.habitId}`}>{h.name}</h3>
                <p>{habitSummary(h)}</p>
                <BarChart
                  title={STATS_TEXTS.habitChart(h.name)}
                  series={[{ label: h.name, points: toPoints(h.points) }]}
                  unit={h.unit}
                  yMin={0}
                  decimals={0}
                  {...dateFormatters(data)}
                />
              </article>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
