/**
 * The greeting after sign-in, at the end of the header row: "Hello Dana, and welcome to your personal
 * diary". Renders nothing when anonymous.
 *
 * It is the only greeting of the page frame (one paragraph in the banner, read once by a screen
 * reader; it is not part of the navigation and not an item of its list), so the navigation row holds
 * links only and no language's sentence can push a link onto a second line. The sentence stays on
 * one line: when the row is too narrow for it (a small window, a very long name) it is cut with an
 * ellipsis and only then gets the whole sentence as its tooltip - the text itself is always complete
 * for assistive technology.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { T } from '@/constants/texts';
import { useAuth } from '@/context/AuthContext';
import { cx } from '@/components/ui/cx';

export interface GreetingProps {
  className?: string;
}

export function Greeting({ className }: GreetingProps) {
  const { status, user } = useAuth();
  const text = status === 'authenticated' && user ? T.greeting(user.firstName) : null;
  const ref = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // The paragraph takes the rest of the header row, so its box follows the window width (and the
    // text size setting).
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  if (text === null) return null;
  return (
    <p ref={ref} className={cx('header__greeting', className)} title={truncated ? text : undefined}>
      {text}
    </p>
  );
}
