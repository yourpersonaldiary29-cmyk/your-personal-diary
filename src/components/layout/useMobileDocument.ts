/**
 * The phone setup of the whole document (the Android and iPhone build only):
 *   - the phone stylesheet (src/styles/mobile.css) in a <style id="mobile-ui-styles">, added once, before the
 *     first paint, and kept;
 *   - the class 'platform-mobile' (plus 'platform-android' / 'platform-ios' inside the native app) on <html>:
 *     every rule of src/styles/mobile.css hangs on it.
 *
 * Two holders use it: the phone frame (MobileShell.tsx) and src/App.tsx, which holds it for as long as the app
 * is mounted in the phone UI - so the "Update needed" screen, which App renders INSTEAD of the frame, keeps the
 * phone setup too: from its first paint (also when it is the first thing the app shows), and with no moment
 * without the classes when it replaces the frame or the frame comes back. The holders are counted: the classes
 * go only when the LAST holder lets go.
 *
 * Import it only behind the spelled-out build flag (`typeof __MOBILE__ !== 'undefined' && __MOBILE__`), as
 * AppShell.tsx and App.tsx do: the desktop bundle must carry neither the phone stylesheet nor this code.
 */
import { useInsertionEffect, useLayoutEffect } from 'react';
import { MOBILE_UI_CLASS } from '@/utils/mobile-ui';
import { platformName } from '@/utils/platform';
// As a string, not as a stylesheet of the bundle: the desktop build must not carry the phone styles,
// and a tree-shaken module cannot take a CSS side effect with it. The hook adds them itself.
import mobileCss from '@/styles/mobile.css?inline';

/** Id of the <style> element holding src/styles/mobile.css. */
export const MOBILE_STYLE_ID = 'mobile-ui-styles';

/** How many mounted components hold the phone setup of the document right now. */
let holders = 0;

/** The classes of <html> for this platform. */
function platformClasses(): string[] {
  const platform = platformName();
  return [MOBILE_UI_CLASS, ...(platform === 'android' || platform === 'ios' ? [`platform-${platform}`] : [])];
}

/**
 * Holds the phone setup of the document while the calling component is mounted: adds the stylesheet once
 * (allowed by the app's CSP: style-src 'unsafe-inline') and puts the classes on <html> before the browser
 * paints; the classes are removed when the last holder unmounts.
 */
export function useMobileDocument(): void {
  useInsertionEffect(() => {
    if (document.getElementById(MOBILE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = MOBILE_STYLE_ID;
    style.textContent = mobileCss;
    document.head.appendChild(style);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const classes = platformClasses();
    holders += 1;
    root.classList.add(...classes);
    return () => {
      holders -= 1;
      if (holders === 0) root.classList.remove(...classes);
    };
  }, []);
}

/** A component that only holds the phone setup of the document (src/App.tsx renders it in the phone UI). */
export function MobileDocument(): null {
  useMobileDocument();
  return null;
}
