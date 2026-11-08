/**
 * Numeric input that reports `number | null` (empty = "not reported", never 0).
 * Keeps the raw text while typing so values like "7." are not lost, and
 * re-syncs from the prop when the value changes from outside.
 */
import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent } from 'react';
import { Field } from './Field';
import { cx } from './cx';

export interface NumberInputProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Unit label shown after the input, e.g. "minutes". */
  unit?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  /** Clamp to min/max when the field loses focus (default true). */
  clampOnBlur?: boolean;
  inputMode?: 'numeric' | 'decimal';
  className?: string;
}

function toText(v: number | null): string {
  return v === null || Number.isNaN(v) ? '' : String(v);
}

export function NumberInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  hint,
  error,
  required = false,
  disabled = false,
  placeholder,
  name,
  clampOnBlur = true,
  inputMode,
  className,
}: NumberInputProps) {
  const [text, setText] = useState(() => toText(value));
  const lastEmitted = useRef<number | null>(value);

  // External change (reset, loaded entry): reflect it in the text.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(toText(value));
    }
  }, [value]);

  const emit = (v: number | null) => {
    lastEmitted.current = v;
    onChange(v);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.currentTarget.value;
    setText(raw);
    if (raw.trim() === '') {
      emit(null);
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n)) emit(n);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (!clampOnBlur) return;
    const raw = e.currentTarget.value.trim();
    if (raw === '') {
      setText('');
      if (lastEmitted.current !== null) emit(null);
      return;
    }
    let n = Number(raw);
    if (!Number.isFinite(n)) {
      setText(toText(lastEmitted.current));
      return;
    }
    if (min !== undefined && n < min) n = min;
    if (max !== undefined && n > max) n = max;
    setText(String(n));
    if (n !== lastEmitted.current) emit(n);
  };

  const unitId = unit ? `${id}-unit` : undefined;

  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => (
        <div className="field__control">
          <input
            {...a11y}
            aria-describedby={[a11y['aria-describedby'], unitId].filter(Boolean).join(' ') || undefined}
            type="number"
            name={name}
            className={cx('input', 'input--number')}
            value={text}
            min={min}
            max={max}
            step={step ?? 'any'}
            disabled={disabled}
            placeholder={placeholder}
            inputMode={inputMode ?? (step !== undefined && Number.isInteger(step) ? 'numeric' : 'decimal')}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          {unit && (
            <span id={unitId} className="field__unit">
              {unit}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}
