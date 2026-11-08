/**
 * 1..10 rating: a range slider (aria-valuetext "7 of 10") synchronised with
 * a number box, a visible value text and a "Clear" button that resets the value
 * to null ("Not reported"). null is never shown as 0.
 */
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { subscribe, tr } from '@/i18n/runtime';
import { NOT_REPORTED, ratingText } from '@/utils/format';
import { cx } from '@/components/ui/cx';
import { fieldIds } from '@/components/ui/Field';

export interface RatingInputProps {
  /** Id of the range input (the label points at it). */
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** Default 1. */
  min?: number;
  /** Default 10. */
  max?: number;
  hint?: string;
  error?: string | null;
  /** Text under the low end of the scale, e.g. "low". */
  lowLabel?: string;
  /** Text under the high end of the scale, e.g. "high". */
  highLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** Keys a range input handles itself (moving the thumb). */
const RANGE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

/** "Clear" in the current language (live ES-module binding). */
export let CLEAR_LABEL = tr('shell.rating.clear');
subscribe(() => {
  CLEAR_LABEL = tr('shell.rating.clear');
});

export function RatingInput({
  id,
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  hint,
  error,
  lowLabel,
  highLabel,
  disabled = false,
  className,
}: RatingInputProps) {
  const { hintId, errorId } = fieldIds(id);
  const numberId = `${id}-number`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const [numberText, setNumberText] = useState(value === null ? '' : String(value));
  const rangeRef = useRef<HTMLInputElement>(null);

  // Keep the number box in step with the value (slider moves, clear, external reset).
  useEffect(() => {
    setNumberText(value === null ? '' : String(value));
  }, [value]);

  const onRange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.currentTarget.value));
  };

  // "Not reported" parks the thumb at the minimum, so the keys that move toward
  // the minimum (Home, PageDown, the decreasing arrow - its side depends on the
  // text direction) change nothing natively and fire no change event. When a
  // key went up and the value is still unset, the user picked the minimum.
  const onRangeKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
    if (value !== null || disabled) return;
    if (RANGE_KEYS.has(e.key)) onChange(min);
  };

  const onNumber = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.currentTarget.value;
    setNumberText(raw);
    if (raw.trim() === '') {
      onChange(null);
      return;
    }
    const n = Math.round(Number(raw));
    if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
  };

  const onNumberBlur = () => {
    if (numberText.trim() === '') return;
    let n = Math.round(Number(numberText));
    if (!Number.isFinite(n)) {
      setNumberText(value === null ? '' : String(value));
      return;
    }
    n = Math.min(max, Math.max(min, n));
    setNumberText(String(n));
    if (n !== value) onChange(n);
  };

  const clear = () => {
    onChange(null);
    rangeRef.current?.focus();
  };

  const valueText = ratingText(value, max);

  return (
    <div className={cx('field', 'rating', className)}>
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      <div className="rating__row">
        <input
          ref={rangeRef}
          type="range"
          id={id}
          className="rating__range"
          min={min}
          max={max}
          step={1}
          value={value ?? min}
          aria-valuetext={valueText}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          onChange={onRange}
          onKeyUp={onRangeKeyUp}
        />
        <input
          type="number"
          id={numberId}
          className="input input--number"
          aria-label={tr('shell.rating.numberBox', { label })}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={numberText}
          disabled={disabled}
          onChange={onNumber}
          onBlur={onNumberBlur}
        />
        <span className={cx('rating__value', value === null && 'rating__value--empty')} aria-hidden="true">
          {value === null ? NOT_REPORTED : valueText}
        </span>
        {value !== null && !disabled && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={clear} aria-label={tr('shell.rating.clearLabel', { label })}>
            {CLEAR_LABEL}
          </button>
        )}
      </div>
      {(lowLabel || highLabel) && (
        <div className="rating__scale" aria-hidden="true">
          <span>
            {min} {lowLabel}
          </span>
          <span>
            {max} {highLabel}
          </span>
        </div>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
