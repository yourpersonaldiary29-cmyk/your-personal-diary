/**
 * Labelled checkbox with an optional hint (linked via aria-describedby).
 *
 * The hint and the error sit inside the <label> so that clicking them toggles the box too, but
 * the accessible name comes from the label text alone (aria-label, the same words as the visible
 * label): otherwise screen readers read the hint as part of the name and then again as the
 * description.
 */
import { useId } from 'react';
import { cx } from './cx';

export interface CheckboxProps {
  label: string;
  /** Extra explanation under the label. */
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  /** Marks the control invalid (aria-invalid) and shows the message. */
  error?: string | null;
  className?: string;
}

export function Checkbox({ label, hint, checked, onChange, id, name, disabled = false, error, className }: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? `chk-${generated}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('check', className)}>
      <input
        type="checkbox"
        id={inputId}
        name={name}
        className="check__input"
        checked={checked}
        disabled={disabled}
        aria-label={hint || error ? label : undefined}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <label htmlFor={inputId} className="check__label">
        {label}
        {hint && (
          <span id={hintId} className="check__hint">
            {hint}
          </span>
        )}
        {error && (
          <span id={errorId} className="field__error">
            {error}
          </span>
        )}
      </label>
    </div>
  );
}
