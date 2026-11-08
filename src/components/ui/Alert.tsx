/**
 * Inline message box. Errors use role="alert" (announced immediately); the
 * other kinds use role="status". The kind is conveyed by an icon and the
 * border, never by colour alone.
 */
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cx } from './cx';

export type AlertKind = 'error' | 'info' | 'success' | 'warning';

export interface AlertProps extends Omit<ComponentPropsWithRef<'div'>, 'title' | 'role'> {
  kind: AlertKind;
  /** Optional heading inside the box. */
  title?: ReactNode;
  children: ReactNode;
  /** Override the automatic role (error -> alert, otherwise status). */
  role?: 'alert' | 'status' | 'none';
}

const ICONS: Record<AlertKind, string> = {
  error: '⚠',
  warning: '⚠',
  info: 'ℹ',
  success: '✓',
};

export function Alert({ kind, title, children, role, className, ...rest }: AlertProps) {
  const resolvedRole = role === 'none' ? undefined : (role ?? (kind === 'error' ? 'alert' : 'status'));
  return (
    <div className={cx('alert', `alert--${kind}`, className)} role={resolvedRole} {...rest}>
      <span className="alert__icon" aria-hidden="true">
        {ICONS[kind]}
      </span>
      <div className="alert__body">
        {title && <p className="alert__title">{title}</p>}
        {typeof children === 'string' ? <p>{children}</p> : children}
      </div>
    </div>
  );
}
