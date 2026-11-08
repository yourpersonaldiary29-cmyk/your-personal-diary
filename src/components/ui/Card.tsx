/**
 * A surface with an optional heading and action buttons.
 * Renders a <section> by default so the title becomes a landmark-friendly heading.
 */
import type { ElementType, ReactNode } from 'react';
import { cx } from './cx';

export interface CardProps {
  /** Heading text (rendered as `headingLevel`, default h2). */
  title?: ReactNode;
  /** Buttons/links shown next to the title. */
  actions?: ReactNode;
  /** Emphasised border (e.g. today's summary). */
  highlight?: boolean;
  children: ReactNode;
  /** Wrapper element, default "section". */
  as?: ElementType;
  /** Heading element for `title`, default "h2". */
  headingLevel?: 'h2' | 'h3' | 'h4';
  className?: string;
  id?: string;
  /** Extra props such as aria-labelledby. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function Card({
  title,
  actions,
  highlight = false,
  children,
  as: Tag = 'section',
  headingLevel: Heading = 'h2',
  className,
  id,
  ...aria
}: CardProps) {
  return (
    <Tag id={id} className={cx('card', highlight && 'card--highlight', className)} {...aria}>
      {(title || actions) && (
        <div className="card__header">
          {title && <Heading className="card__title">{title}</Heading>}
          {actions && <div className="card__actions cluster">{actions}</div>}
        </div>
      )}
      <div className="card__body">{children}</div>
    </Tag>
  );
}
