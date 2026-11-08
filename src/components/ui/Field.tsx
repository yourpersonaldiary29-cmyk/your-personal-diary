/**
 * Form field wrapper: label, optional hint, the control and an error message.
 * The control receives the accessibility wiring through a render prop
 * (`{ id, aria-describedby, aria-invalid, aria-required }`) or, when a plain
 * element is passed, through cloneElement.
 *
 *   <Field id="username" label={T.username} error={errors.username} required>
 *     {(a11y) => <TextInput {...a11y} value={v} onChange={...} />}
 *   </Field>
 */
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { T } from '@/constants/texts';
import { cx } from './cx';

export interface FieldA11yProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

export interface FieldProps {
  /** Id given to the control (the label points at it). */
  id: string;
  label: ReactNode;
  /** Help text shown under the label and linked via aria-describedby. */
  hint?: ReactNode;
  /** Error message (already localised). When set the control gets aria-invalid. */
  error?: string | null;
  /** Adds aria-required and a "(required)" marker. */
  required?: boolean;
  /** Render prop receiving the a11y props, or a single element to clone. */
  children: ReactElement<Partial<FieldA11yProps>> | ((a11y: FieldA11yProps) => ReactNode);
  /** Visually hides the label (it stays available to screen readers). */
  hideLabel?: boolean;
  className?: string;
}

/** Ids used by Field for the hint and error elements (exported for composite inputs). */
export function fieldIds(id: string): { hintId: string; errorId: string } {
  return { hintId: `${id}-hint`, errorId: `${id}-error` };
}

export function Field({ id, label, hint, error, required = false, children, hideLabel = false, className }: FieldProps) {
  const { hintId, errorId } = fieldIds(id);
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  const a11y: FieldA11yProps = { id };
  if (describedBy) a11y['aria-describedby'] = describedBy;
  if (error) a11y['aria-invalid'] = true;
  if (required) a11y['aria-required'] = true;

  const control = typeof children === 'function' ? children(a11y) : isValidElement(children) ? cloneElement(children, a11y) : children;

  return (
    <div className={cx('field', className)}>
      <label htmlFor={id} className={cx('field__label', hideLabel && 'visually-hidden')}>
        {label}
        {required && (
          <span className="field__required" aria-hidden="true">
            ({T.required})
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {control}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
