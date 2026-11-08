/**
 * Loading indicator with a text label (role="status" so it is announced once).
 */
import { T } from '@/constants/texts';
import { cx } from './cx';

export interface SpinnerProps {
  /** Text shown next to the spinner. Default T.loading ("Loading…"). */
  label?: string;
  /** Centered block taking its own row (page-level loading). */
  block?: boolean;
  /** Larger circle for page-level states. */
  size?: 'md' | 'lg';
  className?: string;
}

export function Spinner({ label = T.loading, block = false, size = 'md', className }: SpinnerProps) {
  return (
    <div className={cx('spinner', block && 'spinner--block', size === 'lg' && 'spinner--lg', className)} role="status">
      <span className="spinner__circle" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
