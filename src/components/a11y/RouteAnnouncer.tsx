/**
 * Announces the page title on navigation and keeps `document.title` in the
 * form "Page - App name" (in the current language). Render it BEFORE the
 * routes so a page's own PageTitle (which also sets document.title) wins when
 * it provides a more specific title.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { findRoute, notFoundTitle, welcomeTitle } from '@/constants/routes';
import { T } from '@/constants/texts';
import { useAnnouncer } from '@/context/AnnouncerContext';
import { useAuth } from '@/context/AuthContext';

/** Formats a page title for document.title ("Page - App name", or the app name alone). */
export function documentTitleFor(pageTitle: string | null | undefined): string {
  const page = (pageTitle ?? '').trim();
  return page ? T.documentTitle(page) : T.appName;
}

export function RouteAnnouncer() {
  const location = useLocation();
  const { status } = useAuth();
  const { announce } = useAnnouncer();
  const lastAnnounced = useRef<string | null>(null);

  useEffect(() => {
    const def = findRoute(location.pathname);
    let title = def ? def.title : notFoundTitle();
    if (location.pathname === '/' && status !== 'authenticated') title = welcomeTitle();
    document.title = documentTitleFor(title);

    // Announce only when the path actually changed (not on the first render).
    if (lastAnnounced.current === null) {
      lastAnnounced.current = location.pathname;
      return;
    }
    if (lastAnnounced.current !== location.pathname) {
      lastAnnounced.current = location.pathname;
      announce(title, 'polite');
    }
  }, [location.pathname, status, announce]);

  return null;
}
