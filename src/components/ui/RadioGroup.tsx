/**
 * A group of radio buttons inside <fieldset>/<legend>. Each option may carry a
 * hint. Arrow keys move between options natively.
 */
import { useId } from 'react';
import { cx } from './cx';

export interface RadioOption<V extends string = string> {
  value: V;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface RadioGroupProps<V extends string = string> {
  /** Group label (legend). */
  legend: string;
  /** Shared input name. */
  name: string;
  options: RadioOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  /** Lay the options out in a row. */
  inline?: boolean;
  /** Help text for the whole group. */
  hint?: string;
  error?: string | null;
  required?: boolean;
  /** Borderless variant. */
  plain?: boolean;
  className?: string;
}

export function RadioGroup<V extends string = string>({
  legend,
  name,
  options,
  value,
  onChange,
  inline = false,
  hint,
  error,
  required = false,
  plain = false,
  className,
}: RadioGroupProps<V>) {
  const base = useId();
  const hintId = hint ? `${base}-hint` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset
      className={cx('fieldset', plain && 'fieldset--plain', className)}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      aria-required={required || undefined}
    >
      <legend className="fieldset__legend">{legend}</legend>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      <div className={cx('radio-group', inline && 'radio-group--inline')} role="presentation">
        {options.map((opt) => {
          const id = `${base}-${opt.value}`;
          const optHintId = opt.hint ? `${id}-hint` : undefined;
          return (
            <div className="check" key={opt.value}>
              <input
                type="radio"
                id={id}
                name={name}
                className="check__input"
                value={opt.value}
                checked={value === opt.value}
                disabled={opt.disabled}
                // Name from the option text alone: the hint is the description, not part of the name.
                aria-label={opt.hint ? opt.label : undefined}
                aria-describedby={optHintId}
                onChange={() => onChange(opt.value)}
              />
              <label htmlFor={id} className="check__label">
                {opt.label}
                {opt.hint && (
                  <span id={optHintId} className="check__hint">
                    {opt.hint}
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
