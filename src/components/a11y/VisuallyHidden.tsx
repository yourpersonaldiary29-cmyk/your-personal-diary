/**
 * Renders content for assistive technology only (not visible on screen).
 */
import type { ElementType, ReactNode } from 'react';

export interface VisuallyHiddenProps {
  children: ReactNode;
  /** Element to render, default <span>. */
  as?: ElementType;
  id?: string;
}

export function VisuallyHidden({ children, as: Tag = 'span', id }: VisuallyHiddenProps) {
  return (
    <Tag className="visually-hidden" id={id}>
      {children}
    </Tag>
  );
}
