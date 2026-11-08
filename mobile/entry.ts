/**
 * Entry of the Android (Capacitor) build: the very same UI entry as the desktop app.
 * mobile/index.html loads this file (inside the Vite root, so the dev server can serve it);
 * src/main.tsx sees `__MOBILE__ === true` and starts the mobile host (mobile/host/boot.ts)
 * before it renders the app.
 */
import '../src/main';
