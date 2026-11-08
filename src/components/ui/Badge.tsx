/**
 * Small inline label ("Streak: 5 days", "Strong"). The kind adds colour on top of
 * the text; the text alone must carry the meaning.
 */
import type { ReactNode } from 'react';
import { cx } from './cx';

export type BadgeKind = 'default' | 'primary' | 'success' | 'danger';

export interface BadgeProps {
  /** Default "default" (neutral). */
  kind?: BadgeKind;
  children: ReactNode;
  className?: string;
  /** Optional accessible label when the visible text is terse. */
  'aria-label'?: string;
}

export function Badge({ kind = 'default', children, className, ...aria }: BadgeProps) {
  return (
    <span className={cx('badge', kind !== 'default' && `badge--${kind}`, className)} {...aria}>
      {children}
    </span>
  );
}
