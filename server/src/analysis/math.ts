/**
 * Small, dependency-free statistics helpers used by the pattern detectors.
 *
 * Conventions
 * - Functions never throw on empty input; they return `null` when a value is undefined
 *   (empty sample, zero variance, too few pairs). Callers must treat `null` as "unknown".
 * - `null` entries inside `(number | null)[]` inputs mean "not reported" and are skipped -
 *   they are never treated as 0.
 */

/** Arithmetic mean, or null for an empty sample. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Median (average of the two middle values for even counts), or null for an empty sample. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Sample standard deviation (n - 1 denominator), or null when fewer than 2 values. */
export function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values) as number;
  let ss = 0;
  for (const v of values) ss += (v - m) * (v - m);
  return Math.sqrt(ss / (values.length - 1));
}

/** Variance helper used by pearson / cohenD (population form, n denominator). */
function sumOfSquares(values: number[], m: number): number {
  let ss = 0;
  for (const v of values) ss += (v - m) * (v - m);
  return ss;
}

/**
 * Pearson correlation coefficient of paired samples. Returns null when fewer than 3
 * pairs are available or when either sample has zero variance.
 * Extra elements of the longer array are ignored.
 */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const x = xs.slice(0, n);
  const y = ys.slice(0, n);
  const mx = mean(x) as number;
  const my = mean(y) as number;
  let cov = 0;
  for (let i = 0; i < n; i++) cov += (x[i] - mx) * (y[i] - my);
  const sx = Math.sqrt(sumOfSquares(x, mx));
  const sy = Math.sqrt(sumOfSquares(y, my));
  if (sx === 0 || sy === 0) return null;
  const r = cov / (sx * sy);
  // Guard against floating point drift slightly outside [-1, 1].
  return Math.max(-1, Math.min(1, r));
}

/**
 * Least-squares slope of `ys` against their index (0, 1, 2, ...). Null entries are
 * skipped but keep their index, so gaps do not distort the time axis.
 * Returns null with fewer than 2 non-null points.
 */
export function linearSlope(ys: (number | null)[]): number | null {
  const xs: number[] = [];
  const vals: number[] = [];
  for (let i = 0; i < ys.length; i++) {
    const v = ys[i];
    if (v != null && Number.isFinite(v)) {
      xs.push(i);
      vals.push(v);
    }
  }
  if (xs.length < 2) return null;
  const mx = mean(xs) as number;
  const my = mean(vals) as number;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (vals[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  if (den === 0) return null;
  return num / den;
}

/** Least-squares line (intercept + slope * index) for the non-null points of `ys`. */
export function linearFit(ys: (number | null)[]): { slope: number; intercept: number; count: number } | null {
  const slope = linearSlope(ys);
  if (slope == null) return null;
  const xs: number[] = [];
  const vals: number[] = [];
  for (let i = 0; i < ys.length; i++) {
    const v = ys[i];
    if (v != null && Number.isFinite(v)) {
      xs.push(i);
      vals.push(v);
    }
  }
  const intercept = (mean(vals) as number) - slope * (mean(xs) as number);
  return { slope, intercept, count: xs.length };
}

/**
 * Trailing moving average with the given window. For index i the mean of the non-null
 * values in [i - window + 1, i]; null when that window holds no reported value.
 */
export function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  const w = Math.max(1, Math.floor(window));
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - w + 1); j <= i; j++) {
      const v = values[j];
      if (v != null && Number.isFinite(v)) {
        sum += v;
        count++;
      }
    }
    out[i] = count > 0 ? sum / count : null;
  }
  return out;
}

/**
 * z-score of every value against the sample mean / sample stddev.
 * Returns an array of zeros when the sample has no spread (or fewer than 2 values).
 */
export function zScores(values: number[]): number[] {
  const sd = stddev(values);
  const m = mean(values);
  if (sd == null || sd === 0 || m == null) return values.map(() => 0);
  return values.map((v) => (v - m) / sd);
}

export interface GroupStats {
  countA: number;
  countB: number;
  meanA: number | null;
  meanB: number | null;
  /** meanA - meanB (null when a group is empty). */
  diff: number | null;
  /** Cohen's d with pooled standard deviation (null when it cannot be computed). */
  cohenD: number | null;
}

/** Descriptive comparison of two independent groups. */
export function groupStats(a: number[], b: number[]): GroupStats {
  const meanA = mean(a);
  const meanB = mean(b);
  const diff = meanA != null && meanB != null ? meanA - meanB : null;
  let cohenD: number | null = null;
  if (a.length >= 2 && b.length >= 2 && meanA != null && meanB != null) {
    const ssA = sumOfSquares(a, meanA);
    const ssB = sumOfSquares(b, meanB);
    const pooled = Math.sqrt((ssA + ssB) / (a.length + b.length - 2));
    cohenD = pooled > 0 ? (meanA - meanB) / pooled : null;
  }
  return { countA: a.length, countB: b.length, meanA, meanB, diff, cohenD };
}

/**
 * Welch's t statistic and approximate degrees of freedom (Welch-Satterthwaite).
 * Used only as extra evidence; null when either group has fewer than 2 values or no spread.
 */
export function welchT(a: number[], b: number[]): { t: number; df: number } | null {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a) as number;
  const mb = mean(b) as number;
  const va = sumOfSquares(a, ma) / (a.length - 1);
  const vb = sumOfSquares(b, mb) / (b.length - 1);
  const se2 = va / a.length + vb / b.length;
  if (se2 === 0) return null;
  const t = (ma - mb) / Math.sqrt(se2);
  const dfNum = se2 * se2;
  const dfDen = (va * va) / (a.length * a.length * (a.length - 1)) + (vb * vb) / (b.length * b.length * (b.length - 1));
  const df = dfDen === 0 ? a.length + b.length - 2 : dfNum / dfDen;
  return { t, df };
}

/**
 * Percentile (0..100) with linear interpolation between ranks, or null for an empty sample.
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const clamped = Math.max(0, Math.min(100, p));
  const rank = (clamped / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/** Rounds to `digits` decimals (default 1) - used before numbers are placed in evidence. */
export function round(n: number, digits = 1): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/** Rounds a nullable number, passing null through. */
export function roundOrNull(n: number | null, digits = 1): number | null {
  return n == null ? null : round(n, digits);
}
