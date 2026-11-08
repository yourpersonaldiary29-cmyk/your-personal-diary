/**
 * "Skip to main content" - the first focusable element on every page.
 * With a HashRouter an `href="#main"` would be interpreted as a route, so the
 * click is handled in JavaScript: focus + scroll to the target element.
 */
import type { MouseEvent } from 'react';
import { T } from '@/constants/texts';

export interface SkipLinkProps {
  /** Id of the element to jump to (default "main"). */
  targetId?: string;
  label?: string;
}

export function SkipLink({ targetId = 'main', label = T.skipToContent }: SkipLinkProps) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus();
    target.scrollIntoView({ block: 'start' });
  };
  return (
    <a href={`#${targetId}`} className="skip-link" onClick={onClick}>
      {label}
    </a>
  );
}
