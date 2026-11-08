/**
 * Friendly "nothing here yet" block with an optional call to action.
 */
import type { ReactNode } from 'react';
import { cx } from './cx';

export interface EmptyStateProps {
  /** Decorative icon/emoji (aria-hidden). */
  icon?: ReactNode;
  title: ReactNode;
  /** Explanatory text under the title. */
  text?: ReactNode;
  /** Button or link (e.g. "New entry"). */
  action?: ReactNode;
  /** Heading level for the title, default h2. */
  headingLevel?: 'h2' | 'h3';
  className?: string;
}

export function EmptyState({ icon, title, text, action, headingLevel: Heading = 'h2', className }: EmptyStateProps) {
  return (
    <div className={cx('empty-state', className)}>
      {icon !== undefined && icon !== null && (
        <div className="empty-state__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <Heading className="empty-state__title">{title}</Heading>
      {text && <p>{text}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
