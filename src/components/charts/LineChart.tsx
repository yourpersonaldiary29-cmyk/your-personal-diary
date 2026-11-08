/**
 * Pure-SVG line chart. Accessibility:
 * - <svg role="img"> named by the title and described by the text summary
 *   (min / max / mean / count per series) rendered under the chart.
 * - Series differ by colour AND marker shape AND dash pattern; the legend
 *   shows the same samples.
 * - null values create gaps (never drawn as 0).
 * - "Show as table" reveals the data as a real table.
 */
import { useId } from 'react';
import { cx } from '@/components/ui/cx';
import { DataTableToggle } from './DataTableToggle';
import {
  CHART_MARGIN,
  DASHES,
  NO_DATA_TEXT,
  SHAPES,
  X_AXIS_DEFAULT_LABEL,
  chartTableRows,
  defaultXLabel,
  labelIndices,
  maxXLabels,
  markerPath,
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

export type LineChartProps = ChartProps;

const MARKER_RADIUS = 4;

export function LineChart({
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
}: LineChartProps) {
  const generated = useId();
  const base = id ?? `chart-${generated}`;
  const titleId = `${base}-title`;
  const descId = `${base}-desc`;
  const summaryId = `${base}-summary`;
  const { ref: figureRef, width } = useChartWidth<HTMLElement>();

  const xs = xDomain(series);
  const hasData = series.some((s) => s.points.some((p) => p.y !== null));
  const { ticks, lo: yLo, hi: yHi } = yAxis(series, yMin, yMax, false);

  const plot = {
    x: CHART_MARGIN.left,
    y: CHART_MARGIN.top,
    w: width - CHART_MARGIN.left - CHART_MARGIN.right,
    h: height - CHART_MARGIN.top - CHART_MARGIN.bottom,
  };
  const xPos = (i: number) => (xs.length <= 1 ? plot.x + plot.w / 2 : plot.x + (i * plot.w) / (xs.length - 1));
  const yPos = (v: number) => plot.y + plot.h - ((v - yLo) / (yHi - yLo || 1)) * plot.h;
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
          {/* Horizontal grid + y labels */}
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
          {/* Axes */}
          <line x1={plot.x} x2={plot.x} y1={plot.y} y2={plot.y + plot.h} stroke="var(--chart-axis)" strokeWidth={1.5} />
          <line x1={plot.x} x2={plot.x + plot.w} y1={plot.y + plot.h} y2={plot.y + plot.h} stroke="var(--chart-axis)" strokeWidth={1.5} />
          {/* X ticks + labels */}
          {labels.map((i) => (
            <g key={i}>
              <line x1={xPos(i)} x2={xPos(i)} y1={plot.y + plot.h} y2={plot.y + plot.h + 5} stroke="var(--chart-axis)" strokeWidth={1} />
              <text x={xPos(i)} y={plot.y + plot.h + 20} textAnchor="middle" fontSize={12} fill="var(--chart-axis)">
                {xTickFormatter(xs[i])}
              </text>
            </g>
          ))}
          {/* Series */}
          {series.map((s, si) => {
            const colour = seriesColour(si);
            const shape = s.shape ?? SHAPES[si % SHAPES.length];
            const dash = s.dash ?? DASHES[si % DASHES.length];
            const segments: string[] = [];
            let current: string[] = [];
            const markers: { x: number; y: number; label: string }[] = [];
            for (const p of s.points) {
              const i = xIndex.get(p.x);
              if (i === undefined) continue;
              if (p.y === null || !Number.isFinite(p.y)) {
                if (current.length) segments.push(current.join(' '));
                current = [];
                continue;
              }
              const px = xPos(i);
              const py = yPos(Math.min(yHi, Math.max(yLo, p.y)));
              current.push(`${current.length ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`);
              markers.push({ x: px, y: py, label: pointTooltip(s.label, xLabelFormatter(p.x), valueWithUnit(p.y, unit)) });
            }
            if (current.length) segments.push(current.join(' '));
            return (
              <g key={si} data-series={si}>
                {segments.map((d, k) => (
                  <path key={k} d={d} fill="none" stroke={colour} strokeWidth={2.5} strokeDasharray={dash || undefined} strokeLinejoin="round" strokeLinecap="round" />
                ))}
                {markers.map((m, k) => (
                  <path key={k} d={markerPath(shape, m.x, m.y, MARKER_RADIUS)} fill={colour} stroke="var(--color-surface)" strokeWidth={1}>
                    <title>{m.label}</title>
                  </path>
                ))}
              </g>
            );
          })}
        </svg>
      )}
      {hasData && (
        <ul className="chart__legend">
          {series.map((s, si) => {
            const colour = seriesColour(si);
            const shape = s.shape ?? SHAPES[si % SHAPES.length];
            const dash = s.dash ?? DASHES[si % DASHES.length];
            return (
              <li className="chart__legend-item" key={si}>
                <svg className="chart__legend-sample" viewBox="0 0 40 16" aria-hidden="true" focusable="false">
                  <line x1={0} x2={40} y1={8} y2={8} stroke={colour} strokeWidth={2.5} strokeDasharray={dash || undefined} />
                  <path d={markerPath(shape, 20, 8, 4)} fill={colour} />
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
