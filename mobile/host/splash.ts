/**
 * The start-up splash of the Android build: the `#mobile-splash` element of mobile/index.html.
 * It covers the page from the first paint until the app rendered its first screen - the server
 * mode's start-up (mobile/host/server-mode.ts) removes it once the app had a frame to paint; the
 * local-core build (mobile/host/boot.ts) first waits for the diary core, and if the core cannot
 * start the splash stays and shows why.
 */

export const SPLASH_ID = 'mobile-splash';

/** How long to wait for a frame before removing the splash anyway. */
export const FRAME_FALLBACK_MS = 250;

function splashElement(doc: Document): HTMLElement | null {
  return doc.getElementById(SPLASH_ID);
}

/** Removes the splash (the app is on screen). Safe to call twice, or when there is no splash. */
export function hideSplash(doc: Document = document): void {
  splashElement(doc)?.remove();
}

/** Stops the progress bar and shows `message` on the splash; the splash stays on screen. */
export function showSplashError(message: string, doc: Document = document): void {
  const splash = splashElement(doc);
  if (!splash) return;
  splash.setAttribute('aria-busy', 'false');
  splash.setAttribute('role', 'alert');
  const text = splash.querySelector<HTMLElement>('.mobile-splash__message');
  if (!text) return;
  // The message is in the UI language, the page direction is set later by the app: let the text decide.
  text.setAttribute('dir', 'auto');
  text.textContent = message;
  text.hidden = false;
}

/**
 * Resolves once the page had a frame to paint. A page that is not visible (the app was sent to
 * the background while it started) paints no frame and runs no animation-frame callback, so a
 * timer is the fallback - the splash must never stay because of that.
 */
export function nextFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, FRAME_FALLBACK_MS);
    if (typeof requestAnimationFrame !== 'function') return;
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}
