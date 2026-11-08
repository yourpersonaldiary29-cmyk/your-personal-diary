/**
 * Native time picker (value is `HH:MM` or '' when empty) inside <Field>.
 */
import { Field } from '@/components/ui/Field';
import { cx } from '@/components/ui/cx';

export interface TimeInputProps {
  id: string;
  label: string;
  /** `HH:MM` or '' for empty. */
  value: string;
  onChange: (value: string) => void;
  /** Minute granularity, default 5. */
  stepMinutes?: number;
  hint?: string;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
}

export function TimeInput({
  id,
  label,
  value,
  onChange,
  stepMinutes = 5,
  hint,
  error,
  required = false,
  disabled = false,
  name,
  className,
}: TimeInputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => (
        <input
          {...a11y}
          type="time"
          name={name}
          className={cx('input')}
          value={value}
          step={stepMinutes * 60}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      )}
    </Field>
  );
}
