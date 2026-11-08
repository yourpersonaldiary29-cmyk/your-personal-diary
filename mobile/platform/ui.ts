/**
 * System bars follow the app's theme (WP-9), through Capacitor 8's built-in SystemBars plugin:
 * dark icons on the light page, light icons on the dark page, also for the high-contrast theme
 * (dark) and for "system" (the phone's light/dark setting). The theme is what
 * src/context/SettingsContext.tsx writes to <html data-theme>; this watches that attribute and the
 * prefers-color-scheme media query.
 *
 * Insets and the keyboard need no code here: the manifest's windowSoftInputMode=adjustResize and
 * SystemBars' default `insetsHandling: css` make the page shrink above the keyboard and expose the
 * safe areas as env(safe-area-inset-*), which src/styles/mobile.css already uses.
 */
import type { SystemBarsStyle, SystemBarsStyleOptions } from '@capacitor/core';

/** The part of Capacitor's SystemBars plugin used here (its plugin type is not re-exported by the package). */
export interface SystemBarsLike {
  setStyle(options: SystemBarsStyleOptions): Promise<void>;
}

/** The SystemBars style for a theme: 'LIGHT' = dark icons (light page), 'DARK' = light icons (dark page). */
export function systemBarsStyleFor(theme: string | null | undefined, prefersDark: boolean): 'LIGHT' | 'DARK' {
  switch (theme) {
    case 'light':
      return 'LIGHT';
    case 'dark':
    case 'high-contrast':
      return 'DARK';
    default:
      return prefersDark ? 'DARK' : 'LIGHT';
  }
}

export interface ThemeSources {
  /** The element carrying data-theme (document.documentElement). */
  root: Element;
  /** matchMedia('(prefers-color-scheme: dark)'), or null when unavailable. */
  darkQuery: MediaQueryList | null;
  /** MutationObserver constructor (window.MutationObserver). */
  observe?: typeof MutationObserver;
}

/** Applies the style now and whenever the theme changes; returns the function that stops following. */
export function followThemeWithSystemBars(systemBars: SystemBarsLike, sources: ThemeSources): () => void {
  let applied: 'LIGHT' | 'DARK' | null = null;
  const apply = () => {
    const style = systemBarsStyleFor(sources.root.getAttribute('data-theme'), sources.darkQuery?.matches === true);
    if (style === applied) return;
    applied = style;
    systemBars.setStyle({ style: style as SystemBarsStyle }).catch((e) => {
      applied = null;
      console.warn('[mobile] the system bars could not be styled', e);
    });
  };
  apply();
  const Observer = sources.observe ?? (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
  const observer = Observer ? new Observer(apply) : null;
  observer?.observe(sources.root, { attributes: true, attributeFilter: ['data-theme'] });
  const onMedia = () => apply();
  sources.darkQuery?.addEventListener?.('change', onMedia);
  return () => {
    observer?.disconnect();
    sources.darkQuery?.removeEventListener?.('change', onMedia);
  };
}
