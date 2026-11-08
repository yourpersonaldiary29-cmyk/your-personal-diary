/**
 * Shared types and maths for the SVG charts (LineChart / BarChart).
 * Everything here is pure so it can be unit-tested without the DOM. The few
 * texts (summary sentences, empty state, x-axis header) come from the
 * 'stats.chart.*' catalogue keys in the current UI language.
 */
import { subscribe, tr } from '@/i18n/runtime';
import { isValidIsoDate, formatDayMonth } from '@/utils/dates';
import { formatDecimal, formatNumber } from '@/utils/format';

export type MarkerShape = 'circle' | 'square' | 'triangle' | 'diamond';

export interface ChartPoint {
  /** Category / date on the x axis (ISO dates are formatted as "7.9"). */
  x: string;
  /** null = no data for this x (drawn as a gap, never as 0). */
  y: number | null;
}

export interface ChartSeries {
  /** Series name shown in the legend, the summary and the data table (already localised). */
  label: string;
  points: ChartPoint[];
  /** Marker shape (LineChart). Defaults cycle circle/square/triangle/diamond. */
  shape?: MarkerShape;
  /** SVG stroke-dasharray for the line (LineChart). Defaults cycle solid/dashed/dotted. */
  dash?: string;
}

export interface ChartProps {
  /** Chart title (figure caption + accessible name). */
  title: string;
  /** Optional longer description added to the accessible description. */
  description?: string;
  series: ChartSeries[];
  /** Fixed lower bound of the y axis (default: from the data). */
  yMin?: number;
  /** Fixed upper bound of the y axis (default: from the data). */
  yMax?: number;
  /** Unit appended to values in the summary and tooltips, e.g. "hours". */
  unit?: string;
  /** Formats x values for axis labels and the table (default: ISO date -> "7.9"). */
  xLabelFormatter?: (x: string) => string;
  /**
   * Formats x values for the axis tick labels only (default: xLabelFormatter), so the axis can
   * stay short ("Wed", "7.9") while the table, tooltips and summary use the full form.
   */
  xTickFormatter?: (x: string) => string;
  /** SVG height in CSS pixels (default 260). */
  height?: number;
  /** Decimals used for means in the summary (default 1). */
  decimals?: number;
  /** Header of the x column in the data table (default: the localised "Date"). */
  xAxisLabel?: string;
  /** Hide the "Show as table" toggle (when the page renders its own table). */
  noTable?: boolean;
  className?: string;
  id?: string;
}

/** Widest drawing (SVG user units); wider boxes scale this drawing up. */
export const CHART_WIDTH = 640;
/** Narrowest drawing; a smaller box scales it down. */
export const CHART_MIN_WIDTH = 240;

/**
 * Drawing width for a chart box `available` CSS pixels wide: the box itself (clamped to
 * CHART_MIN_WIDTH..CHART_WIDTH). On a phone the SVG is then drawn 1:1, so the 12px axis labels
 * stay 12px, instead of a 640-unit drawing shrunk to 40% (5px labels); on a wide screen the
 * 640-unit drawing scales up as before.
 */
export function chartWidthFor(available: number): number {
  if (!Number.isFinite(available) || available <= 0) return CHART_WIDTH;
  return Math.round(Math.min(CHART_WIDTH, Math.max(CHART_MIN_WIDTH, available)));
}

/** Rough width of one character of the 12px axis font, and the gap between two labels. */
const LABEL_CHAR_PX = 6.5;
const LABEL_GAP_PX = 6;

/** How many x labels (at most 8) fit side by side in `plotWidth`, judged by the longest one. */
export function maxXLabels(plotWidth: number, labels: string[]): number {
  const longest = labels.reduce((m, l) => Math.max(m, [...l].length), 1);
  return Math.max(2, Math.min(8, Math.floor(plotWidth / (longest * LABEL_CHAR_PX + LABEL_GAP_PX))));
}
export const CHART_MARGIN = { top: 18, right: 16, bottom: 40, left: 54 };
export const SHAPES: MarkerShape[] = ['circle', 'square', 'triangle', 'diamond'];
export const DASHES = ['', '7 4', '2 3', '9 3 2 3', '4 2'];

/** "No data to display" in the current language. */
export function noDataText(): string {
  return tr('stats.chart.noData');
}

/** Default header of the x column ("Date") in the current language. */
export function xAxisDefaultLabel(): string {
  return tr('stats.chart.xAxisDate');
}

/**
 * The same texts as values (live ES-module bindings that follow the current
 * language, for the chart components' default props). Prefer the functions in new code.
 */
export let NO_DATA_TEXT = noDataText();
export let X_AXIS_DEFAULT_LABEL = xAxisDefaultLabel();
subscribe(() => {
  NO_DATA_TEXT = noDataText();
  X_AXIS_DEFAULT_LABEL = xAxisDefaultLabel();
});

/** CSS variable for the i-th series colour (5 distinct colours, then repeats). */
export function seriesColour(index: number): string {
  return `var(--chart-${(index % 5) + 1})`;
}

/** Ordered union of x values across all series (first-seen order). */
export function xDomain(series: ChartSeries[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of series) {
    for (const p of s.points) {
      if (!seen.has(p.x)) {
        seen.add(p.x);
        out.push(p.x);
      }
    }
  }
  return out;
}

/** Numeric y values (nulls skipped). */
export function allValues(series: ChartSeries[]): number[] {
  const out: number[] = [];
  for (const s of series) for (const p of s.points) if (p.y !== null && Number.isFinite(p.y)) out.push(p.y);
  return out;
}

/**
 * Lower/upper bound of the y axis. Explicit bounds win; otherwise the data
 * extent (padded when flat). `includeZero` forces 0 into the range (bars).
 */
export function yExtent(series: ChartSeries[], yMin?: number, yMax?: number, includeZero = false): [number, number] {
  const values = allValues(series);
  let lo = yMin ?? (values.length ? Math.min(...values) : 0);
  let hi = yMax ?? (values.length ? Math.max(...values) : 1);
  if (includeZero) {
    if (yMin === undefined) lo = Math.min(lo, 0);
    if (yMax === undefined) hi = Math.max(hi, 0);
  }
  if (hi === lo) {
    if (yMin === undefined) lo = lo - 1;
    if (yMax === undefined) hi = hi + 1;
    if (hi === lo) hi = lo + 1;
  }
  return [lo, hi];
}

function niceNumber(range: number, round: boolean): number {
  if (range <= 0 || !Number.isFinite(range)) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let nice: number;
  if (round) {
    nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  } else {
    nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  }
  return nice * 10 ** exponent;
}

function tidy(n: number): number {
  return Number(n.toFixed(10));
}

/**
 * Axis ticks. With `fixed` the ticks stay inside [min, max] and include both
 * bounds; otherwise the range is extended to "nice" numbers.
 */
export function niceTicks(min: number, max: number, count = 5, fixed = false): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min, max].filter(Number.isFinite);
  const step = niceNumber(niceNumber(max - min, false) / Math.max(1, count - 1), true);
  const ticks: number[] = [];
  if (fixed) {
    ticks.push(tidy(min));
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
      const t = tidy(v);
      if (t > min && t < max) ticks.push(t);
    }
    ticks.push(tidy(max));
  } else {
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(tidy(v));
  }
  return Array.from(new Set(ticks));
}

/**
 * Y axis of a chart: the tick values and the bounds of the plot. A bound the caller fixed
 * (`yMin` / `yMax`) is kept exactly; a bound that comes from the data is rounded out to the
 * next "nice" tick. So a 0-based chart whose data peaks at 42 gets 0, 10 ... 50 - not 40 plus
 * an extra "42" label drawn on top of it.
 */
export function yAxis(series: ChartSeries[], yMin?: number, yMax?: number, includeZero = false): { ticks: number[]; lo: number; hi: number } {
  const [lo, hi] = yExtent(series, yMin, yMax, includeZero);
  if (yMin !== undefined && yMax !== undefined) return { ticks: niceTicks(lo, hi, 5, true), lo, hi };
  const nice = niceTicks(lo, hi, 5, false);
  const axisLo = yMin ?? nice[0];
  const axisHi = yMax ?? nice[nice.length - 1];
  let ticks = nice.filter((t) => t >= axisLo - 1e-9 && t <= axisHi + 1e-9);
  // Whole-number data (counts, a habit done 0 or 1 times) gets whole-number labels only - no
  // "0.2, 0.4, 0.6" on the axis of something that is never a fraction.
  const values = allValues(series);
  if (values.length && values.every(Number.isInteger)) {
    const whole = ticks.filter(Number.isInteger);
    if (whole.length >= 2) ticks = whole;
  }
  return { ticks: ticks.length ? ticks : [axisLo, axisHi], lo: axisLo, hi: axisHi };
}

export interface SeriesStats {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
}

/** min / max / mean / count over the non-null points. */
export function seriesStats(points: ChartPoint[]): SeriesStats {
  const values = points.map((p) => p.y).filter((y): y is number => y !== null && Number.isFinite(y));
  if (values.length === 0) return { count: 0, min: null, max: null, mean: null };
  const sum = values.reduce((a, b) => a + b, 0);
  return { count: values.length, min: Math.min(...values), max: Math.max(...values), mean: sum / values.length };
}

/** Attaches the unit to an already formatted value ("7.5 hours"); no unit -> the value alone. */
export function withUnit(value: string, unit?: string): string {
  return unit ? tr('stats.chart.valueWithUnit', { value, unit }) : value;
}

/** Summary sentence for one series in the current language. */
export function summaryText(label: string, stats: SeriesStats, unit?: string, decimals = 1): string {
  if (stats.count === 0) return tr('stats.chart.summaryEmpty', { label });
  return tr('stats.chart.summary', {
    label,
    count: stats.count,
    min: withUnit(formatNumber(stats.min), unit),
    max: withUnit(formatNumber(stats.max), unit),
    mean: withUnit(formatDecimal(stats.mean, decimals), unit),
  });
}

/** Sentence describing the x range ("4 time points, from 1.9 to 4.9."). */
export function rangeText(xs: string[], xLabel: (x: string) => string): string {
  if (xs.length === 0) return '';
  return tr('stats.chart.range', { count: xs.length, from: xLabel(xs[0]), to: xLabel(xs[xs.length - 1]) });
}

/** ISO dates -> "7.9"; anything else unchanged. */
export function defaultXLabel(x: string): string {
  return isValidIsoDate(x) ? formatDayMonth(x) : x;
}

/** Indices of the x labels to draw so they never overlap (at most ~8). */
export function labelIndices(n: number, maxLabels = 8): number[] {
  if (n <= 0) return [];
  if (n <= maxLabels) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil((n - 1) / (maxLabels - 1));
  const out: number[] = [];
  for (let i = 0; i < n; i += step) out.push(i);
  if (out[out.length - 1] !== n - 1) {
    // Replace the last label when it would sit too close to the final one.
    if (n - 1 - out[out.length - 1] < step / 2) out.pop();
    out.push(n - 1);
  }
  return out;
}

/** SVG path for a marker centred at (cx, cy) with "radius" r. */
export function markerPath(shape: MarkerShape, cx: number, cy: number, r: number): string {
  switch (shape) {
    case 'square':
      return `M${cx - r},${cy - r}h${2 * r}v${2 * r}h${-2 * r}Z`;
    case 'triangle':
      return `M${cx},${cy - r * 1.15}L${cx + r * 1.1},${cy + r * 0.85}L${cx - r * 1.1},${cy + r * 0.85}Z`;
    case 'diamond':
      return `M${cx},${cy - r * 1.25}L${cx + r * 1.25},${cy}L${cx},${cy + r * 1.25}L${cx - r * 1.25},${cy}Z`;
    case 'circle':
    default:
      return `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
  }
}

/** Rows for the data table: one row per x, first cell the formatted x label. */
export function chartTableRows(xs: string[], series: ChartSeries[], xLabel: (x: string) => string): (string | number | null)[][] {
  const lookups = series.map((s) => new Map(s.points.map((p) => [p.x, p.y] as const)));
  return xs.map((x) => [xLabel(x), ...lookups.map((m) => m.get(x) ?? null)]);
}

/** Value text used in tooltips and tables, with the unit. */
export function valueWithUnit(y: number | null, unit?: string): string {
  if (y === null) return formatNumber(null);
  return withUnit(formatNumber(y), unit);
}

/** Tooltip (<title>) of one bar / marker: "Mood, 7.9: 8" in the current language. */
export function pointTooltip(seriesLabel: string, xLabel: string, value: string): string {
  return tr('stats.chart.pointTooltip', { label: seriesLabel, x: xLabel, value });
}
