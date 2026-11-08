/**
 * Navigation of the phone shell, built from the shared navigation definitions (NAV_ITEMS), so the
 * labels are the same translated texts as the desktop navigation bar:
 *   - bottom navigation: Home, My diary, Calendar, Habits (+ the "More" button);
 *   - "More" sheet: Insights, Statistics, Search, Backup, Settings (+ Log out).
 * "New entry" is the floating button (Fab.tsx). Also the small line icons of the shell - decorative
 * (aria-hidden): every control carries a visible text label or an aria-label.
 */
import { matchPath } from 'react-router-dom';
import { NAV_ITEMS, type NavItem } from '@shared/constants';
import { PATHS } from '@/constants/routes';

/** Destinations of the bottom navigation, in NAV_ITEMS order. */
export const BOTTOM_NAV_PATHS: readonly string[] = [PATHS.home, PATHS.diary, PATHS.calendar, PATHS.habits];

/** Destinations of the "More" sheet, in NAV_ITEMS order. */
export const MORE_NAV_PATHS: readonly string[] = [PATHS.insights, PATHS.stats, PATHS.search, PATHS.backup, PATHS.settings];

export function bottomNavItems(): NavItem[] {
  return NAV_ITEMS.filter((item) => BOTTOM_NAV_PATHS.includes(item.path));
}

/** The pages of the "More" sheet. A guest (tour mode) gets no Backup: nothing of a guest is written to the device. */
export function moreNavItems(guest = false): NavItem[] {
  return NAV_ITEMS.filter((item) => MORE_NAV_PATHS.includes(item.path) && !(guest && item.path === PATHS.backup));
}

/**
 * A page without a back arrow in the app bar: the destinations of the bottom navigation when signed
 * in, the welcome page ("/") otherwise.
 */
export function isTopLevelPath(pathname: string, authenticated: boolean): boolean {
  if (pathname === PATHS.home) return true;
  return authenticated && BOTTOM_NAV_PATHS.includes(pathname);
}

/**
 * The bottom-navigation section a page belongs to (for the highlighted item): one of
 * BOTTOM_NAV_PATHS, 'more' for the pages of the sheet, or null. Entry pages belong to "My diary".
 */
export function navSectionOf(pathname: string): string | null {
  if (pathname === PATHS.home) return PATHS.home;
  for (const path of BOTTOM_NAV_PATHS) {
    if (path !== PATHS.home && (pathname === path || pathname.startsWith(`${path}/`))) return path;
  }
  if (pathname === PATHS.newEntry || pathname.startsWith('/entry/') || pathname.startsWith('/day/')) return PATHS.diary;
  if (MORE_NAV_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return 'more';
  return null;
}

/**
 * Where the floating "New entry" button leads on this page, or null where it is not shown: the home
 * page and the diary open an empty entry, a day page opens an entry for that day.
 */
export function fabTargetFor(pathname: string): string | null {
  if (pathname === PATHS.home || pathname === PATHS.diary) return PATHS.newEntry;
  const day = matchPath({ path: '/day/:date', end: true }, pathname);
  const date = day?.params.date;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return `${PATHS.newEntry}?date=${date}`;
  return null;
}

export type ShellIconName =
  | 'home'
  | 'diary'
  | 'calendar'
  | 'habits'
  | 'more'
  | 'insights'
  | 'stats'
  | 'search'
  | 'backup'
  | 'settings'
  | 'logout'
  | 'keyboard'
  | 'plus'
  | 'back'
  | 'forward';

const ICON_PATHS: Record<ShellIconName, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  diary: 'M7 4h11v16H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM5 18a2 2 0 0 1 2-2h11M9.5 8.5h5',
  calendar: 'M4 6h16v14H4zM4 10.5h16M8 3.5v4M16 3.5v4',
  habits: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.8 2.8L16 9.5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  insights: 'M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.1 1.1 1.7h5c.1-.6.5-1.2 1.1-1.7A6 6 0 0 0 12 3z',
  stats: 'M5 20V11M12 20V4M19 20v-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  backup: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  logout: 'M10 4H5v16h5M14.5 8l4 4-4 4M18 12H9.5',
  keyboard: 'M3 7h18v10H3zM7 10.5h.01M11 10.5h.01M15 10.5h.01M8 14h8',
  plus: 'M12 5v14M5 12h14',
  back: 'M19 12H5M11 6l-6 6 6 6',
  forward: 'M5 12h14M13 6l6 6-6 6',
};

/** NAV_ITEMS path -> icon. */
const PATH_ICONS: Record<string, ShellIconName> = {
  [PATHS.home]: 'home',
  [PATHS.diary]: 'diary',
  [PATHS.calendar]: 'calendar',
  [PATHS.habits]: 'habits',
  [PATHS.insights]: 'insights',
  [PATHS.stats]: 'stats',
  [PATHS.search]: 'search',
  [PATHS.backup]: 'backup',
  [PATHS.settings]: 'settings',
};

export function iconForPath(path: string): ShellIconName {
  return PATH_ICONS[path] ?? 'more';
}

export interface ShellIconProps {
  name: ShellIconName;
  className?: string;
}

/** A 24px line icon in the current text colour. Decorative: hidden from assistive technology. */
export function ShellIcon({ name, className }: ShellIconProps) {
  return (
    <svg
      className={className ? `shell-icon ${className}` : 'shell-icon'}
      data-icon={name}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
