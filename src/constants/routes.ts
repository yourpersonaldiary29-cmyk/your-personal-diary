/**
 * Route table: path patterns, page titles (in the current language) and
 * whether a session is required. Used by the router (guards), the
 * RouteAnnouncer (document.title + announcement), the navigation bar and by
 * pages that want to build links.
 */
import { matchPath } from 'react-router-dom';
import type { NavItem } from '@shared/constants';
import { subscribe, tr } from '@/i18n/runtime';

export interface RouteDef {
  /** react-router path pattern, e.g. "/entry/:id". */
  path: string;
  /** Catalogue key of the page title ('shell.route.*'). */
  titleKey: string;
  /** Page title in the current language (used for document.title and the route announcement). */
  readonly title: string;
  /** Redirect to /login when there is no session. */
  requiresAuth: boolean;
}

export const PATHS = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  newEntry: '/new',
  entry: (id: number | string) => `/entry/${id}`,
  editEntry: (id: number | string) => `/entry/${id}/edit`,
  diary: '/diary',
  day: (date: string) => `/day/${date}`,
  calendar: '/calendar',
  habits: '/habits',
  insights: '/insights',
  stats: '/stats',
  search: '/search',
  backup: '/backup',
  settings: '/settings',
} as const;

function route(path: string, titleKey: string, requiresAuth: boolean): RouteDef {
  return {
    path,
    titleKey,
    requiresAuth,
    get title() {
      return tr(titleKey);
    },
  };
}

export const ROUTE_DEFS: RouteDef[] = [
  route('/', 'shell.route.home', false),
  route('/login', 'shell.route.login', false),
  route('/register', 'shell.route.register', false),
  // Password reset by e-mail (public; the page titles live in the 'auth' catalogue area).
  route('/forgot-password', 'auth.forgot.title', false),
  route('/reset-password', 'auth.reset.title', false),
  route('/new', 'shell.route.newEntry', true),
  route('/entry/:id', 'shell.route.entry', true),
  route('/entry/:id/edit', 'shell.route.editEntry', true),
  route('/diary', 'shell.route.diary', true),
  route('/day/:date', 'shell.route.day', true),
  route('/calendar', 'shell.route.calendar', true),
  route('/habits', 'shell.route.habits', true),
  route('/insights', 'shell.route.insights', true),
  route('/stats', 'shell.route.stats', true),
  route('/search', 'shell.route.search', true),
  route('/backup', 'shell.route.backup', true),
  route('/settings', 'shell.route.settings', false),
];

/** Title shown for "/" when nobody is logged in. */
export function welcomeTitle(): string {
  return tr('shell.route.welcome');
}

/** Title of the 404 page. */
export function notFoundTitle(): string {
  return tr('shell.notFoundTitle');
}

/**
 * The same titles as plain strings (live ES-module bindings: they follow the
 * current language). Prefer the functions above in new code.
 */
export let WELCOME_TITLE = welcomeTitle();
export let NOT_FOUND_TITLE = notFoundTitle();
subscribe(() => {
  WELCOME_TITLE = welcomeTitle();
  NOT_FOUND_TITLE = notFoundTitle();
});

/** Finds the route definition matching a concrete pathname (e.g. "/entry/12"). */
export function findRoute(pathname: string): RouteDef | null {
  for (const def of ROUTE_DEFS) {
    if (matchPath({ path: def.path, end: true }, pathname)) return def;
  }
  return null;
}

/** Catalogue keys of the navigation labels (shared/constants.ts NAV_ITEMS), by path. */
const NAV_LABEL_KEYS: Record<string, string> = {
  '/': 'shell.nav.home',
  '/new': 'shell.nav.newEntry',
  '/diary': 'shell.nav.diary',
  '/calendar': 'shell.nav.calendar',
  '/habits': 'shell.nav.habits',
  '/insights': 'shell.nav.insights',
  '/stats': 'shell.nav.stats',
  '/search': 'shell.nav.search',
  '/backup': 'shell.nav.backup',
  '/settings': 'shell.nav.settings',
};

/**
 * Label of a navigation item in the current language: its 'shell.nav.*' key,
 * else the title of the route it points at, else the label defined in NAV_ITEMS.
 */
export function navItemLabel(item: Pick<NavItem, 'path' | 'label'>): string {
  const key = NAV_LABEL_KEYS[item.path];
  if (key) {
    const text = tr(key);
    if (text !== key) return text;
  }
  return findRoute(item.path)?.title ?? item.label;
}
