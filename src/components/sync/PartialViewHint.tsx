/**
 * "Shown from what is saved on this device – some details may be missing." (docs/android-tasks/
 * OFFLINE-DESIGN.md section 4.6 "Missing views"): a view the offline engine put together from cached
 * records because the page itself was never cached. Renders nothing for every other value - online, or
 * with offline mode off, nothing changes on the pages.
 */
import { isPartialView } from '@/offline';
import { tr } from '@/i18n/runtime';
import './sync.css';

export function PartialViewHint({ value }: { value: unknown }) {
  if (!isPartialView(value)) return null;
  return (
    <p className="sync-hint" data-testid="partial-view-hint">
      {tr('shell.sync.partialView')}
    </p>
  );
}
