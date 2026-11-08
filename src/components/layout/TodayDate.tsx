/**
 * Today's weekday and Gregorian date in the UI language ("Monday, 7 September
 * 2026" / "יום שני, 7 בספטמבר 2026") in the header. Refreshed automatically
 * at midnight; a language change remounts it (App re-keys its subtree).
 */
import { useEffect, useState } from 'react';
import { formatFullDate, msUntilMidnight, todayIso } from '@/utils/dates';
import { cx } from '@/components/ui/cx';

export interface TodayDateProps {
  className?: string;
}

export function TodayDate({ className }: TodayDateProps) {
  const [iso, setIso] = useState(() => todayIso());

  useEffect(() => {
    let timer = window.setTimeout(function tick() {
      setIso(todayIso());
      timer = window.setTimeout(tick, msUntilMidnight());
    }, msUntilMidnight());
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <p className={cx('header__date', className)}>
      <time dateTime={iso}>{formatFullDate(iso)}</time>
    </p>
  );
}
