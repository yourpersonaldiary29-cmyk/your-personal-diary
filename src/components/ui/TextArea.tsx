/**
 * Multi-line text input styled with `.textarea`. With `autosize` the height
 * follows the content (no inner scrollbar), which keeps long diary entries
 * readable and avoids nested scrolling for screen-reader users.
 */
import { useCallback, useEffect, useRef, type ChangeEvent, type ComponentPropsWithRef } from 'react';
import { cx } from './cx';

export interface TextAreaProps extends ComponentPropsWithRef<'textarea'> {
  /** Grow with the content instead of showing a scrollbar. */
  autosize?: boolean;
  /** Minimum rows when autosizing (default 4). */
  minRows?: number;
}

function resize(el: HTMLTextAreaElement, minRows: number): void {
  el.style.height = 'auto';
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
  const min = lineHeight * minRows;
  el.style.height = `${Math.max(min, el.scrollHeight)}px`;
}

export function TextArea({ className, autosize = false, minRows = 4, onChange, ref, value, rows, ...rest }: TextAreaProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref && typeof ref === 'object') (ref as { current: HTMLTextAreaElement | null }).current = el;
    },
    [ref],
  );

  // Resize whenever the controlled value changes (typing, reset, load).
  useEffect(() => {
    if (autosize && innerRef.current) resize(innerRef.current, minRows);
  }, [autosize, minRows, value]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (autosize) resize(e.currentTarget, minRows);
    onChange?.(e);
  };

  return (
    <textarea
      ref={setRefs}
      className={cx('textarea', autosize && 'textarea--autosize', className)}
      rows={rows ?? minRows}
      value={value}
      onChange={handleChange}
      {...rest}
    />
  );
}
