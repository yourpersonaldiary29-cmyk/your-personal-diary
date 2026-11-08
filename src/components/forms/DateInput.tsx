/**
 * Native date picker (value is `YYYY-MM-DD` or '' when empty) inside <Field>.
 * The native control gives keyboard and screen-reader support for free.
 */
import { Field } from '@/components/ui/Field';
import { cx } from '@/components/ui/cx';

export interface DateInputProps {
  id: string;
  label: string;
  /** ISO date or '' for empty. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest allowed ISO date. */
  min?: string;
  /** Latest allowed ISO date. */
  max?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
}

export function DateInput({ id, label, value, onChange, min, max, hint, error, required = false, disabled = false, name, className }: DateInputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => (
        <input
          {...a11y}
          type="date"
          name={name}
          className={cx('input')}
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      )}
    </Field>
  );
}
