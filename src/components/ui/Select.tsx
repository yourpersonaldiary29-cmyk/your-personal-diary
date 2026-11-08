/**
 * Native <select> with label, hint and error (wrapped in <Field>).
 */
import { Field } from './Field';
import { cx } from './cx';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<V extends string = string> {
  id: string;
  label: string;
  options: SelectOption<V>[];
  value: V;
  onChange: (value: V) => void;
  hint?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  /** Visually hide the label (keeps it for screen readers). */
  hideLabel?: boolean;
  className?: string;
}

export function Select<V extends string = string>({
  id,
  label,
  options,
  value,
  onChange,
  hint,
  error,
  required = false,
  disabled = false,
  name,
  hideLabel = false,
  className,
}: SelectProps<V>) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} hideLabel={hideLabel} className={className}>
      {(a11y) => (
        <select
          {...a11y}
          name={name}
          className={cx('select')}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.value as V)}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
