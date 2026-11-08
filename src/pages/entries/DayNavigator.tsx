/**
 * "הקודם / היום / הבא" navigation with the current range as visible text.
 * Whenever the label changes after the first render it is announced politely,
 * so screen-reader users hear where they landed without leaving the buttons.
 */
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { ET } from './texts';

export interface DayNavigatorProps {
  /** Current range text, e.g. "יום שני, 7 בספטמבר 2026" or "ספטמבר 2026". */
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Default "הקודם". */
  previousLabel?: string;
  /** Default "הבא". */
  nextLabel?: string;
  /** Default "היום". */
  todayLabel?: string;
  /** Accessible name of the <nav>, default "ניווט בין תקופות". */
  navLabel?: string;
  className?: string;
}

export function DayNavigator({
  label,
  onPrevious,
  onNext,
  onToday,
  previousLabel = ET.previous,
  nextLabel = ET.next,
  todayLabel = ET.today,
  navLabel = ET.navLabel,
  className,
}: DayNavigatorProps) {
  const { announce } = useAnnouncer();
  const lastLabel = useRef<string | null>(null);

  useEffect(() => {
    if (lastLabel.current === null) {
      lastLabel.current = label;
      return;
    }
    if (lastLabel.current !== label) {
      lastLabel.current = label;
      announce(label, 'polite');
    }
  }, [label, announce]);

  return (
    <nav className={cx('day-navigator', className)} aria-label={navLabel}>
      <Button variant="secondary" size="sm" onClick={onPrevious}>
        {previousLabel}
      </Button>
      <Button variant="secondary" size="sm" onClick={onToday}>
        {todayLabel}
      </Button>
      <Button variant="secondary" size="sm" onClick={onNext}>
        {nextLabel}
      </Button>
      <p className="day-navigator__label">{label}</p>
    </nav>
  );
}
