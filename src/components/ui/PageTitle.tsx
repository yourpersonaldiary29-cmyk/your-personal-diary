/**
 * The page's <h1> (focused after in-app navigation via FocusHeading) with an
 * optional subtitle and action buttons. Also sets document.title.
 */
import type { ReactNode } from 'react';
import { FocusHeading } from '@/components/a11y/FocusHeading';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cx } from './cx';

/** Id of the page's <h1> (the target of focus after navigation and after unlocking). */
export const PAGE_TITLE_ID = 'page-title';

export interface PageTitleProps {
  /** Heading text. Also used for document.title (when a string). */
  title: ReactNode;
  /** Text used for document.title when `title` is not a plain string. */
  documentTitle?: string;
  /** Secondary line under the heading (date, count...). */
  subtitle?: ReactNode;
  /** Buttons/links aligned to the other side of the heading. */
  actions?: ReactNode;
  /** Focus behaviour, see FocusHeading (default "navigation"). */
  focus?: 'navigation' | 'always' | 'never';
  id?: string;
  className?: string;
}

export function PageTitle({ title, documentTitle, subtitle, actions, focus, id = PAGE_TITLE_ID, className }: PageTitleProps) {
  useDocumentTitle(documentTitle ?? (typeof title === 'string' ? title : null));
  return (
    <div className={cx('page-title', className)}>
      <div>
        <FocusHeading id={id} className="page-title__heading" focus={focus}>
          {title}
        </FocusHeading>
        {subtitle && <p className="page-title__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-title__actions">{actions}</div>}
    </div>
  );
}
