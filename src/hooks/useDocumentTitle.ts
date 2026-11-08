/**
 * Sets `document.title` to "<title> - <app name>" while the component is
 * mounted. RouteAnnouncer sets a generic title on every navigation; a page's
 * own title (rendered later in the tree) wins because its effect runs after.
 */
import { useEffect } from 'react';
import { documentTitleFor } from '@/components/a11y/RouteAnnouncer';

export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const t = (title ?? '').trim();
    if (!t) return;
    document.title = documentTitleFor(t);
  }, [title]);
}
