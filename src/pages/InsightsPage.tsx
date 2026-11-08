/**
 * Insights page: GET /api/insights?period=… grouped into sections (trends,
 * habits, sleep and activity, days and times, emotions and people, anomalies).
 * Every insight is an <article> with a strength badge and a "Why did I get
 * this insight?" disclosure. Notes about checks that lacked data are listed
 * at the end. Texts: 'insights.*'.
 */
import { useMemo, useState } from 'react';
import type { Period } from '@shared/types';
import { ANALYSIS } from '@shared/constants';
import * as api from '@/api';
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
import { formatShortDate } from '@/utils/dates';
import { InsightCard } from './insights/InsightCard';
import { groupInsights } from './insights/insight-groups';
import { inPeriodText, periodOptions } from './insights/periods';

export const INSIGHTS_TEXTS = {
  get title() {
    return tr('insights.title');
  },
  get period() {
    return tr('insights.period');
  },
  get refresh() {
    return tr('insights.refresh');
  },
  get notesTitle() {
    return tr('insights.notesTitle');
  },
  get disclaimer() {
    return tr('insights.disclaimer');
  },
  get emptyTitle() {
    return tr('insights.empty.title');
  },
  get emptyText() {
    return tr('insights.empty.text', { minDays: ANALYSIS.minDaysForRelationship, minGroupSize: ANALYSIS.minGroupSize });
  },
  get newEntry() {
    return tr('insights.newEntry');
  },
  /** "43 days with data in the last 30 days (25/08/2026 – 23/09/2026)". */
  summary: (days: number, period: Period, start: string, end: string) =>
    tr('insights.summary', { count: days, inPeriod: inPeriodText(period), start: formatShortDate(start), end: formatShortDate(end) }),
  found: (n: number) => tr('insights.found', { count: n }),
} as const;

/**
 * Online only (docs/android-tasks/OFFLINE-DESIGN.md section 6.2): while the automatic offline mode runs
 * without a connection the page says "This needs a connection to the diary server." [Try again];
 * otherwise (and always while offline mode is off) it is the page as it was.
 */
export default function InsightsPage() {
  const offlineNow = useOfflineNow();
  if (offlineNow) return <NeedsConnectionPage title={INSIGHTS_TEXTS.title} />;
  return <InsightsPageContent />;
}

function InsightsPageContent() {
  const { settings } = useSettings();
  const { announce } = useAnnouncer();
  const [period, setPeriod] = useState<Period>(settings.defaultPeriod);
  const { data, loading, error, reload } = useApi(() => api.insights.report(period), [period], {
    onSuccess: (report) => announce(INSIGHTS_TEXTS.found(report.insights.length), 'polite'),
  });
  const groups = useMemo(() => groupInsights(data?.insights ?? []), [data]);

  return (
    <div className="stack">
      <PageTitle
        title={INSIGHTS_TEXTS.title}
        subtitle={data ? INSIGHTS_TEXTS.summary(data.daysWithData, data.period, data.periodStart, data.periodEnd) : undefined}
        actions={
          <Button variant="secondary" onClick={() => void reload()} loading={loading}>
            {INSIGHTS_TEXTS.refresh}
          </Button>
        }
      />
      <div className="cluster">
        <Select<Period> id="insights-period" label={INSIGHTS_TEXTS.period} options={periodOptions()} value={period} onChange={setPeriod} />
      </div>
      <p className="text-muted text-small">{INSIGHTS_TEXTS.disclaimer}</p>

      {loading && !data && <Spinner block size="lg" />}
      {error && (
        <Alert kind="error">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            {T.retry}
          </Button>
        </Alert>
      )}

      {data && groups.length === 0 && (
        <EmptyState title={INSIGHTS_TEXTS.emptyTitle} text={INSIGHTS_TEXTS.emptyText} action={<LinkButton to={PATHS.newEntry}>{INSIGHTS_TEXTS.newEntry}</LinkButton>} />
      )}

      {groups.map(({ group, insights }) => (
        <section key={group.id} aria-labelledby={`insights-group-${group.id}`} className="stack">
          <h2 id={`insights-group-${group.id}`}>{group.title}</h2>
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </section>
      ))}

      {data && data.notes.length > 0 && (
        <section aria-labelledby="insights-notes-title" className="card">
          <h2 id="insights-notes-title">{INSIGHTS_TEXTS.notesTitle}</h2>
          <ul>
            {data.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
