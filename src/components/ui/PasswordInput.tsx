/**
 * Password field with a show/hide toggle. The toggle is a real button whose name is the action it
 * performs ("Show password" / "Hide password"). It deliberately has no aria-pressed: a changing
 * name together with a pressed state reads "Hide password, toggle button, pressed" - a contradiction.
 * All accessibility props (id, aria-describedby, aria-invalid...) go to the input.
 */
import { useState, type ComponentPropsWithRef } from 'react';
import { T } from '@/constants/texts';
import { cx } from './cx';

export interface PasswordInputProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  /** Hide the show/hide toggle (rare). */
  noToggle?: boolean;
}

export function PasswordInput({ className, noToggle = false, autoComplete = 'current-password', ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input
        type={visible ? 'text' : 'password'}
        className={cx('input', className)}
        autoComplete={autoComplete}
        spellCheck={false}
        autoCapitalize="off"
        {...rest}
      />
      {!noToggle && (
        <button
          type="button"
          className="btn btn--secondary password-field__toggle"
          onClick={() => setVisible((v) => !v)}
        >
          {/* Both labels share one grid cell, so the button is as wide as the longer one in every
              language and keeps its size (and its row) when toggled; the inactive one is hidden,
              also from the accessible name. */}
          <span className="password-field__label" aria-hidden={visible ? 'true' : undefined}>
            {T.showPassword}
          </span>
          <span className="password-field__label" aria-hidden={visible ? undefined : 'true'}>
            {T.hidePassword}
          </span>
        </button>
      )}
    </div>
  );
}
