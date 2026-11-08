/**
 * Term/value pairs as a real <dl> (screen readers announce "term, value").
 * `null` values render as "Not reported".
 */
import type { ReactNode } from 'react';
import { NOT_REPORTED } from '@/utils/format';
import { cx } from './cx';

export interface DefinitionItem {
  term: ReactNode;
  /** null -> "Not reported". */
  value: ReactNode | null;
}

export interface DefinitionListProps {
  items: DefinitionItem[];
  className?: string;
  'aria-label'?: string;
}

export function DefinitionList({ items, className, ...aria }: DefinitionListProps) {
  return (
    <dl className={cx('definition-list', className)} {...aria}>
      {items.map((item, i) => (
        <div className="definition-list__row" key={i} style={{ display: 'contents' }}>
          <dt>{item.term}</dt>
          <dd>{item.value === null || item.value === undefined || item.value === '' ? NOT_REPORTED : item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
