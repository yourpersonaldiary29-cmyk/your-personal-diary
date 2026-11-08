/**
 * Determinate progress bar (habit completion, streak targets).
 * role="progressbar" with aria-valuenow/min/max and an aria-valuetext in the
 * current language such as "5 of 8 glasses"; the same text is visible next to the bar.
 */
import { tr } from '@/i18n/runtime';
import { formatNumber } from '@/utils/format';
import { cx } from './cx';

export interface ProgressBarProps {
  /** Current amount (clamped to 0..max for the fill). */
  value: number;
  /** Target amount; must be > 0. */
  max: number;
  /** Accessible name, e.g. the habit name. */
  label: string;
  /** Unit appended to the visible/aria text, e.g. "glasses". */
  unit?: string;
  /** Custom value text (default "value of max unit"). */
  valueText?: string;
  /** Hide the visible text (the aria-valuetext remains). */
  hideText?: boolean;
  className?: string;
}

export function ProgressBar({ value, max, label, unit, valueText, hideText = false, className }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(safeMax, Math.max(0, value));
  const percent = Math.round((clamped / safeMax) * 100);
  const text =
    valueText ??
    (unit
      ? tr('shell.progress.valueWithUnit', { value: formatNumber(value), max: formatNumber(max), unit })
      : tr('shell.progress.value', { value: formatNumber(value), max: formatNumber(max) }));
  const complete = value >= max;

  return (
    <div className={cx('progress', complete && 'progress--complete', className)}>
      <div
        className="progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={text}
      >
        <div className="progress__bar" style={{ width: `${percent}%` }} />
      </div>
      {!hideText && (
        <span className="progress__text" aria-hidden="true">
          {text}
        </span>
      )}
    </div>
  );
}
