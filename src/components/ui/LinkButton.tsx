/**
 * A react-router <Link> that looks like a button. Use it for navigation
 * ("New entry", "Sign up"); use <Button> for actions.
 */
import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import type { ButtonSize, ButtonVariant } from './Button';
import { cx } from './cx';

export interface LinkButtonProps extends LinkProps {
  /** Visual style. Default "primary". */
  variant?: ButtonVariant;
  /** Default "md". */
  size?: ButtonSize;
  /** Full-width. */
  block?: boolean;
  /** Decorative icon rendered before the label (aria-hidden). */
  icon?: ReactNode;
  children: ReactNode;
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  block = false,
  icon,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={cx('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className)}
      {...rest}
    >
      {icon !== undefined && icon !== null && (
        <span className="btn__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </Link>
  );
}
