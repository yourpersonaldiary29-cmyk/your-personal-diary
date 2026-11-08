/**
 * The Content-Security-Policy of mobile/index.html, edited by mobile/vite.config.mobile.ts:
 *
 *  - for the BUILD of the published (server-only) app (`serverBuildCsp`), the fixed origin of the
 *    Your Personal Diary server is added to `connect-src` (`allowConnectOrigin`): the one remote
 *    origin the WebView may talk to. The source page says `connect-src 'self'` and the origin comes
 *    from src/config/server-default.json at build time, so the host is spelled in one place only
 *    (scripts/check-no-network.mjs rule 5). The same build also drops what only the in-process core
 *    needs (`SERVER_BUILD_REMOVALS`: `'wasm-unsafe-eval'` for its SQLite wasm, `blob:` workers for
 *    its inline worker) - the published app has neither. The local-core build (MOBILE_LOCAL_CORE=1)
 *    keeps the page's policy as it is: its core answers in-process and it fetches nothing remote;
 *  - for `npm run mobile:dev` ONLY, the policy is relaxed (`relaxCsp`): Vite's React plugin injects
 *    an inline preamble script and HMR talks over a WebSocket, both of which the strict policy of
 *    the Android build forbids; a developer API base (`VITE_API_BASE`, a local test server) is let
 *    through `connect-src` when it is a loopback origin.
 *
 * Every rewrite edits the directives inside the `content` attribute of the CSP <meta> tag - never
 * other text of the page that merely mentions a directive (such as the comment above the tag).
 */

/** The CSP <meta> tag: (1) everything up to the policy, (2) the policy, (3) the closing quote. */
const CSP_META = /(<meta\s[^>]*http-equiv="Content-Security-Policy"[^>]*?\scontent=")([^"]*)(")/;

/** What the dev server adds to a directive. */
const DEV_SOURCES: Record<string, string[]> = {
  'script-src': ["'unsafe-inline'"],
  'connect-src': ['ws://127.0.0.1:*', 'ws://localhost:*'],
};

/**
 * The policy with `additions` (directive name -> sources) appended to their directives. A directive
 * that is not in the policy throws: the page must declare it, a silent default would be wider.
 */
export function addCspSources(policy: string, additions: Record<string, string[]>): string {
  const seen = new Set<string>();
  const directives = policy
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive !== '')
    .map((directive) => {
      const name = directive.split(/\s+/)[0].toLowerCase();
      const extra = additions[name];
      if (!extra || extra.length === 0) return directive;
      seen.add(name);
      const present = new Set(directive.split(/\s+/).slice(1));
      return [directive, ...extra.filter((source) => !present.has(source))].join(' ');
    });
  for (const [name, extra] of Object.entries(additions)) {
    if (extra.length > 0 && !seen.has(name)) throw new Error(`mobile/index.html: the CSP has no ${name} directive to add ${extra.join(' ')} to`);
  }
  return directives.join('; ');
}

/**
 * The policy with `removals` (directive name -> sources) taken out of their directives. A directive
 * is never removed as a whole (a missing directive would fall back to a wider default); one that is
 * not in the policy throws, as in `addCspSources`. Removing a source that is not there is a no-op.
 */
export function removeCspSources(policy: string, removals: Record<string, string[]>): string {
  const seen = new Set<string>();
  const directives = policy
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive !== '')
    .map((directive) => {
      const [name, ...sources] = directive.split(/\s+/);
      const drop = removals[name.toLowerCase()];
      if (!drop || drop.length === 0) return directive;
      seen.add(name.toLowerCase());
      const kept = sources.filter((source) => !drop.includes(source));
      if (kept.length === 0) throw new Error(`mobile/index.html: removing ${drop.join(' ')} would leave ${name} empty`);
      return [name, ...kept].join(' ');
    });
  for (const [name, drop] of Object.entries(removals)) {
    if (drop.length > 0 && !seen.has(name)) throw new Error(`mobile/index.html: the CSP has no ${name} directive to remove ${drop.join(' ')} from`);
  }
  return directives.join('; ');
}

/** The policy with the dev-server sources appended to their directives. */
export function relaxCsp(policy: string): string {
  return addCspSources(policy, DEV_SOURCES);
}

/** The CSP of the page (the `content` of its CSP <meta> tag), or null when it has none. */
export function readCsp(html: string): string | null {
  return CSP_META.exec(html)?.[2] ?? null;
}

/** The page with its policy replaced by `edit(policy)`; throws when the tag is missing. */
export function rewriteCsp(html: string, edit: (policy: string) => string): string {
  if (!CSP_META.test(html)) throw new Error('mobile/index.html: the Content-Security-Policy <meta> tag was not found');
  return html.replace(CSP_META, (_tag, before: string, policy: string, after: string) => before + edit(policy) + after);
}

/**
 * A loopback origin (`http://127.0.0.1:<port>`, `http://localhost:<port>`) or null: the only kind of
 * developer API base the dev server page may be allowed to call. Anything else is refused here, not
 * widened into the policy.
 */
export function loopbackOrigin(value: string | undefined): string | null {
  if (!value || value.trim() === '') return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * The page with its CSP <meta> relaxed for the dev server; throws when the tag is missing.
 * `apiBase` is the developer's `VITE_API_BASE`, added to `connect-src` when it is a loopback origin.
 */
export function relaxCspForDevServer(html: string, apiBase?: string): string {
  const origin = loopbackOrigin(apiBase);
  return rewriteCsp(html, (policy) => addCspSources(relaxCsp(policy), origin ? { 'connect-src': [origin] } : {}));
}

/**
 * The page with `origin` (an `https://<host>` origin, no path) added to `connect-src`: the Android
 * build's fixed diary server. Throws on anything that is not a bare https origin, so a bad
 * server-default.json fails the build instead of widening the policy.
 */
export function allowConnectOrigin(html: string, origin: string): string {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`mobile CSP: the server origin is not a URL: ${origin}`);
  }
  if (parsed.protocol !== 'https:' || parsed.origin !== origin) {
    throw new Error(`mobile CSP: the server origin must be https://<host> with no path: ${origin}`);
  }
  return rewriteCsp(html, (policy) => addCspSources(policy, { 'connect-src': [origin] }));
}

/**
 * What the policy of the page keeps only for the local-core build: `'wasm-unsafe-eval'` (the SQLite
 * wasm of the in-process core) and `blob:` workers (its inline worker starts from a blob: URL). The
 * published, server-only build has no wasm and no worker, so its page drops both.
 */
export const SERVER_BUILD_REMOVALS: Readonly<Record<string, string[]>> = {
  'script-src': ["'wasm-unsafe-eval'"],
  'worker-src': ['blob:'],
};

/**
 * The page of the published (server-only) Android build: `origin` added to `connect-src` (see
 * `allowConnectOrigin`, which also validates it) and `SERVER_BUILD_REMOVALS` taken out.
 */
export function serverBuildCsp(html: string, origin: string): string {
  return rewriteCsp(allowConnectOrigin(html, origin), (policy) => removeCspSources(policy, { ...SERVER_BUILD_REMOVALS }));
}
