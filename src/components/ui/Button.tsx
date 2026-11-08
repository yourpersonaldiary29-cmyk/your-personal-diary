/**
 * Accessible button. While `loading` the button keeps its label, exposes
 * `aria-busy` and shows a spinner; clicks are ignored but focus is kept (a
 * `disabled` button would throw focus to <body>, which is confusing for
 * screen-reader users).
 */
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'type'> {
  /** Visual style. Default "primary". */
  variant?: ButtonVariant;
  /** Default "md". */
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and ignores clicks; the label stays visible. */
  loading?: boolean;
  /** Full-width button. */
  block?: boolean;
  /** Decorative icon rendered before the label (aria-hidden). */
  icon?: ReactNode;
  /** Native type. Default "button" so buttons inside forms never submit by accident. */
  type?: 'button' | 'submit' | 'reset';
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  icon,
  type = 'button',
  className,
  children,
  onClick,
  disabled,
  ...rest
}: ButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  return (
    <button
      type={type}
      className={cx('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className)}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      disabled={disabled}
      onClick={handleClick}
      {...rest}
    >
      {loading && <span className="spinner__circle btn__spinner" aria-hidden="true" />}
      {!loading && icon !== undefined && icon !== null && (
        <span className="btn__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
