/**
 * Pure-SVG bar chart (grouped bars when several series). Series differ by
 * colour AND fill pattern (solid / diagonal / dots / horizontal / cross) so
 * they stay distinguishable in monochrome. Same accessibility contract as
 * LineChart: role="img" + text summary + optional data table.
 */
import { useId } from 'react';
import { cx } from '@/components/ui/cx';
import { DataTableToggle } from './DataTableToggle';
import {
  CHART_MARGIN,
  NO_DATA_TEXT,
  X_AXIS_DEFAULT_LABEL,
  chartTableRows,
  defaultXLabel,
  labelIndices,
  maxXLabels,
  pointTooltip,
  rangeText,
  seriesColour,
  seriesStats,
  summaryText,
  valueWithUnit,
  xDomain,
  yAxis,
  type ChartProps,
} from './chart-utils';
import { useChartWidth } from './useChartWidth';
import { formatNumber } from '@/utils/format';

export type BarChartProps = ChartProps;

type PatternKind = 'solid' | 'diagonal' | 'dots' | 'horizontal' | 'cross';
const PATTERNS: PatternKind[] = ['solid', 'diagonal', 'dots', 'horizontal', 'cross'];

function PatternDef({ id, kind, colour }: { id: string; kind: PatternKind; colour: string }) {
  if (kind === 'solid') return null;
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={8} height={8}>
      {kind === 'diagonal' && <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke={colour} strokeWidth={2} />}
      {kind === 'dots' && <circle cx={4} cy={4} r={1.8} fill={colour} />}
      {kind === 'horizontal' && <path d="M0,4 h8" stroke={colour} strokeWidth={2} />}
      {kind === 'cross' && <path d="M0,4 h8 M4,0 v8" stroke={colour} strokeWidth={1.5} />}
    </pattern>
  );
}

export function BarChart({
  title,
  description,
  series,
  yMin,
  yMax,
  unit,
  xLabelFormatter = defaultXLabel,
  xTickFormatter = xLabelFormatter,
  height = 260,
  decimals = 1,
  xAxisLabel = X_AXIS_DEFAULT_LABEL,
  noTable = false,
  className,
  id,
}: BarChartProps) {
  const generated = useId();
  const base = id ?? `chart-${generated}`;
  const titleId = `${base}-title`;
  const descId = `${base}-desc`;
  const summaryId = `${base}-summary`;
  const { ref: figureRef, width } = useChartWidth<HTMLElement>();
  const patternId = (si: number) => `${base}-pattern-${si}`;

  const xs = xDomain(series);
  const hasData = series.some((s) => s.points.some((p) => p.y !== null));
  const { ticks, lo: yLo, hi: yHi } = yAxis(series, yMin, yMax, true);

  const plot = {
    x: CHART_MARGIN.left,
    y: CHART_MARGIN.top,
    w: width - CHART_MARGIN.left - CHART_MARGIN.right,
    h: height - CHART_MARGIN.top - CHART_MARGIN.bottom,
  };
  const n = Math.max(1, xs.length);
  const groupWidth = plot.w / n;
  const seriesCount = Math.max(1, series.length);
  const barWidth = Math.max(2, (groupWidth * 0.72) / seriesCount);
  const groupCenter = (i: number) => plot.x + (i + 0.5) * groupWidth;
  const yPos = (v: number) => plot.y + plot.h - ((v - yLo) / (yHi - yLo || 1)) * plot.h;
  const baseline = yPos(Math.min(Math.max(0, yLo), yHi));
  const xIndex = new Map(xs.map((x, i) => [x, i]));
  const labels = labelIndices(xs.length, maxXLabels(plot.w, xs.map(xTickFormatter)));

  const stats = series.map((s) => seriesStats(s.points));
  const tableRows = chartTableRows(xs, series, xLabelFormatter);

  return (
    <figure className={cx('chart', className)} id={base} ref={figureRef}>
      <figcaption id={titleId} className="chart__title">
        {title}
      </figcaption>
      {description && (
        <p id={descId} className="text-muted text-small">
          {description}
        </p>
      )}
      {!hasData ? (
        <p className="chart__empty">{NO_DATA_TEXT}</p>
      ) : (
        <svg
          className="chart__svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby={titleId}
          aria-describedby={description ? `${descId} ${summaryId}` : summaryId}
          focusable="false"
        >
          <defs>
            {series.map((_, si) => (
              <PatternDef key={si} id={patternId(si)} kind={PATTERNS[si % PATTERNS.length]} colour={seriesColour(si)} />
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={plot.x} x2={plot.x + plot.w} y1={yPos(t)} y2={yPos(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={plot.x - 8} y={yPos(t) + 4} textAnchor="end" fontSize={12} fill="var(--chart-axis)">
                {formatNumber(t)}
              </text>
            </g>
          ))}
          {unit && (
            <text x={plot.x - 8} y={plot.y - 6} textAnchor="end" fontSize={12} fill="var(--chart-axis)">
              {unit}
            </text>
          )}
          <line x1={plot.x} x2={plot.x} y1={plot.y} y2={plot.y + plot.h} stroke="var(--chart-axis)" strokeWidth={1.5} />
          <line x1={plot.x} x2={plot.x + plot.w} y1={baseline} y2={baseline} stroke="var(--chart-axis)" strokeWidth={1.5} />
          {labels.map((i) => (
            <g key={i}>
              <line x1={groupCenter(i)} x2={groupCenter(i)} y1={plot.y + plot.h} y2={plot.y + plot.h + 5} stroke="var(--chart-axis)" strokeWidth={1} />
              <text x={groupCenter(i)} y={plot.y + plot.h + 20} textAnchor="middle" fontSize={12} fill="var(--chart-axis)">
                {xTickFormatter(xs[i])}
              </text>
            </g>
          ))}
          {series.map((s, si) => {
            const colour = seriesColour(si);
            const pattern = PATTERNS[si % PATTERNS.length];
            const fill = pattern === 'solid' ? colour : `url(#${patternId(si)})`;
            return (
              <g key={si} data-series={si}>
                {s.points.map((p, k) => {
                  const i = xIndex.get(p.x);
                  if (i === undefined || p.y === null || !Number.isFinite(p.y)) return null;
                  const v = Math.min(yHi, Math.max(yLo, p.y));
                  const x = groupCenter(i) - (seriesCount * barWidth) / 2 + si * barWidth;
                  const top = Math.min(yPos(v), baseline);
                  const h = Math.max(1, Math.abs(yPos(v) - baseline));
                  return (
                    <rect key={k} x={x.toFixed(1)} y={top.toFixed(1)} width={barWidth.toFixed(1)} height={h.toFixed(1)} fill={fill} stroke={colour} strokeWidth={1}>
                      <title>{pointTooltip(s.label, xLabelFormatter(p.x), valueWithUnit(p.y, unit))}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}
      {hasData && (
        <ul className="chart__legend">
          {series.map((s, si) => {
            const colour = seriesColour(si);
            const pattern = PATTERNS[si % PATTERNS.length];
            const legendPattern = `${patternId(si)}-legend`;
            return (
              <li className="chart__legend-item" key={si}>
                <svg className="chart__legend-sample" viewBox="0 0 40 16" aria-hidden="true" focusable="false">
                  <defs>
                    <PatternDef id={legendPattern} kind={pattern} colour={colour} />
                  </defs>
                  <rect x={1} y={1} width={38} height={14} fill={pattern === 'solid' ? colour : `url(#${legendPattern})`} stroke={colour} strokeWidth={1.5} />
                </svg>
                <span>{s.label}</span>
              </li>
            );
          })}
        </ul>
      )}
      <ul className="chart__summary" id={summaryId}>
        {hasData && <li>{rangeText(xs, xLabelFormatter)}</li>}
        {series.map((s, si) => (
          <li key={si}>{summaryText(s.label, stats[si], unit, decimals)}</li>
        ))}
      </ul>
      {hasData && !noTable && (
        <DataTableToggle caption={title} columns={[xAxisLabel, ...series.map((s) => s.label)]} rows={tableRows} decimals={decimals} />
      )}
    </figure>
  );
}
