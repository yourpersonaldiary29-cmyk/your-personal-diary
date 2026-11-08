/**
 * Floating "New entry" button of the phone shell, shown on the home page, the diary and a day page
 * (there it opens an entry for that day). A link with a visible label, so it needs no tooltip and
 * reads as "New entry" to a screen reader. The pages' own "New entry" button in the title row is
 * hidden by mobile.css while this one is on screen.
 */
import { Link, useLocation } from 'react-router-dom';
import { tr } from '@/i18n/runtime';
import { ShellIcon, fabTargetFor } from './mobile-nav';

export function Fab() {
  const location = useLocation();
  const target = fabTargetFor(location.pathname);
  if (!target) return null;
  return (
    <Link to={target} className="fab">
      <ShellIcon name="plus" />
      <span className="fab__label">{tr('shell.nav.newEntry')}</span>
    </Link>
  );
}
