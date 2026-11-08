/**
 * A visually hidden ARIA live region. Usually you want `useAnnouncer()` instead
 * of rendering this directly; the AnnouncerProvider owns the global regions.
 */
export interface LiveRegionProps {
  /** Text to announce. Changing it triggers the announcement. */
  message: string;
  politeness?: 'polite' | 'assertive';
  /** Extra class names (the region is visually hidden by default). */
  className?: string;
  id?: string;
}

export function LiveRegion({ message, politeness = 'polite', className, id }: LiveRegionProps) {
  return (
    <div
      id={id}
      className={`visually-hidden${className ? ` ${className}` : ''}`}
      role={politeness === 'assertive' ? 'alert' : 'status'}
      aria-live={politeness}
      aria-atomic="true"
      data-testid={`live-region-${politeness}`}
    >
      {message}
    </div>
  );
}
