/**
 * The page's main heading. It has `tabIndex=-1` (no visible outline) and
 * receives focus when it appears after an in-app navigation, so screen-reader
 * users land on the new page's title. It does not steal focus on the very first
 * page load (the skip link stays first) or while the user is typing.
 */
import { useContext, useEffect, useRef, type ReactNode } from 'react';
import { hasFocusToRestore } from '@/context/LanguageContext';
import { UNSAFE_LocationContext } from 'react-router-dom';

export interface FocusHeadingProps {
  children: ReactNode;
  /** Heading level, default h1. */
  as?: 'h1' | 'h2' | 'h3';
  id?: string;
  className?: string;
  /**
   * 'navigation' (default): focus after in-app navigation only;
   * 'always': focus whenever mounted; 'never': never move focus.
   */
  focus?: 'navigation' | 'always' | 'never';
}

function userIsTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
}

export function FocusHeading({ children, as: Tag = 'h1', id, className, focus = 'navigation' }: FocusHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  // Reading the context directly keeps the component usable outside a router.
  const locationCtx = useContext(UNSAFE_LocationContext);
  const key = locationCtx?.location.key ?? null;
  const pathname = locationCtx?.location.pathname ?? null;

  // Only a *path* change counts as navigation. Pages that rewrite the query
  // string in place (search "?q=", diary "?tag=", calendar "?year=&month=")
  // create a new location key without leaving the page, and stealing focus
  // from the control the user just operated would break keyboard use.
  useEffect(() => {
    if (focus === 'never') return;
    if (focus === 'navigation' && (key === null || key === 'default')) return;
    if (userIsTyping()) return;
    // The page was only rebuilt for a language change: the focus goes back to the control the user
    // operated (App.tsx), not to the heading.
    if (hasFocusToRestore()) return;
    ref.current?.focus({ preventScroll: false });
    // Re-run when the path changes so a page reused for different params also announces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, pathname]);

  return (
    <Tag ref={ref} id={id} tabIndex={-1} className={className}>
      {children}
    </Tag>
  );
}
