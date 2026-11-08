/**
 * One insight as an <article>: strength badge (text + a distinct border style
 * per strength, never colour alone), title, hedged sentence and the
 * "Why did I get this insight?" disclosure with the explanation, an evidence
 * table and links to the supporting days. Texts: 'insights.card.*'.
 */
import { useId, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Insight, InsightStrength } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { cx } from '@/components/ui/cx';
import { PATHS } from '@/constants/routes';
import { tr } from '@/i18n/runtime';
import { formatShortDate } from '@/utils/dates';
import { formatDecimal, formatNumber, formatSigned } from '@/utils/format';
import { DIRECTION_LABELS, STRENGTH_LABELS } from './insight-groups';

export const INSIGHT_CARD_TEXTS = {
  get why() {
    return tr('insights.card.why');
  },
  get evidenceCaption() {
    return tr('insights.card.evidenceCaption');
  },
  get relatedDays() {
    return tr('insights.card.relatedDays');
  },
  get detail() {
    return tr('insights.card.detail');
  },
  get value() {
    return tr('insights.card.value');
  },
  get daysExamined() {
    return tr('insights.card.daysExamined');
  },
  get metric() {
    return tr('insights.card.metric');
  },
  get correlation() {
    return tr('insights.card.correlation');
  },
  get effectSize() {
    return tr('insights.card.effectSize');
  },
  period: (start: string, end: string) => tr('insights.card.period', { start: formatShortDate(start), end: formatShortDate(end) }),
  /** "12 days, mean 5.8" / "12 days" for a comparison group row. */
  groupRow: (count: number, mean: number | null) =>
    mean === null ? tr('insights.card.groupRowNoMean', { count }) : tr('insights.card.groupRow', { count, mean: formatDecimal(mean) }),
} as const;

/** Border per strength: width AND style differ, so the level is visible without colour. */
const BORDER_BY_STRENGTH: Record<InsightStrength, CSSProperties> = {
  strong: { borderWidth: 3, borderStyle: 'solid' },
  moderate: { borderWidth: 2, borderStyle: 'dashed' },
  weak: { borderWidth: 1, borderStyle: 'dotted' },
};

const BADGE_BY_STRENGTH: Record<InsightStrength, 'primary' | 'default'> = {
  strong: 'primary',
  moderate: 'default',
  weak: 'default',
};

export interface InsightCardProps {
  insight: Insight;
  /** Heading level of the title (default h3, under the group's h2). */
  headingLevel?: 'h2' | 'h3';
  /** Start with the explanation open. */
  defaultExpanded?: boolean;
  className?: string;
}

export function InsightCard({ insight, headingLevel: Heading = 'h3', defaultExpanded = false, className }: InsightCardProps) {
  const base = useId();
  const titleId = `insight-${base}-title`;
  const panelId = `insight-${base}-why`;
  const [open, setOpen] = useState(defaultExpanded);
  const { evidence } = insight;

  return (
    <article className={cx('card', 'insight', `insight--${insight.strength}`, className)} aria-labelledby={titleId} style={BORDER_BY_STRENGTH[insight.strength]}>
      <div className="cluster">
        <Badge kind={BADGE_BY_STRENGTH[insight.strength]}>{STRENGTH_LABELS[insight.strength]}</Badge>
        {insight.positive !== null && (
          <Badge kind={insight.positive ? 'success' : 'danger'}>{insight.positive ? DIRECTION_LABELS.positive : DIRECTION_LABELS.attention}</Badge>
        )}
      </div>
      <Heading id={titleId} className="card__title">
        {insight.title}
      </Heading>
      <p>{insight.text}</p>
      <p className="text-muted text-small">{INSIGHT_CARD_TEXTS.period(insight.periodStart, insight.periodEnd)}</p>
      {/* Every card has the same button text; the insight's title (as the description) tells a
          screen reader which insight the button opens, e.g. in a list of all buttons. */}
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={titleId}
        onClick={() => setOpen((v) => !v)}
      >
        {INSIGHT_CARD_TEXTS.why}
      </button>
      {open && (
        <div id={panelId} className="stack-sm">
          <p>{insight.explanation}</p>
          <div className="scroll-x">
            <table>
              <caption>{INSIGHT_CARD_TEXTS.evidenceCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{INSIGHT_CARD_TEXTS.detail}</th>
                  <th scope="col">{INSIGHT_CARD_TEXTS.value}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{INSIGHT_CARD_TEXTS.daysExamined}</th>
                  <td>{formatNumber(evidence.daysExamined)}</td>
                </tr>
                {evidence.metricLabel && (
                  <tr>
                    <th scope="row">{INSIGHT_CARD_TEXTS.metric}</th>
                    <td>{evidence.metricLabel}</td>
                  </tr>
                )}
                {evidence.groupALabel && (
                  <tr>
                    <th scope="row">{evidence.groupALabel}</th>
                    <td>{INSIGHT_CARD_TEXTS.groupRow(evidence.groupACount, evidence.groupAMean)}</td>
                  </tr>
                )}
                {evidence.groupBLabel && (
                  <tr>
                    <th scope="row">{evidence.groupBLabel}</th>
                    <td>{INSIGHT_CARD_TEXTS.groupRow(evidence.groupBCount, evidence.groupBMean)}</td>
                  </tr>
                )}
                {evidence.correlation !== null && (
                  <tr>
                    <th scope="row">{INSIGHT_CARD_TEXTS.correlation}</th>
                    <td>{formatDecimal(evidence.correlation, 2)}</td>
                  </tr>
                )}
                {evidence.effectSize !== null && (
                  <tr>
                    <th scope="row">{INSIGHT_CARD_TEXTS.effectSize}</th>
                    <td>{formatSigned(evidence.effectSize)}</td>
                  </tr>
                )}
                {evidence.extra.map((kv, i) => (
                  <tr key={`${kv.key}-${i}`}>
                    <th scope="row">{kv.key}</th>
                    <td>{kv.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {evidence.dates.length > 0 && (
            <div>
              <p>
                <strong>{INSIGHT_CARD_TEXTS.relatedDays}</strong>
              </p>
              <ul className="cluster">
                {evidence.dates.map((date) => (
                  <li key={date}>
                    <Link to={PATHS.day(date)}>{formatShortDate(date)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
