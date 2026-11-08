/**
 * The post-build audit of the hosted server bundle (docs/HOSTED-PLAN.md 5.8 rule 2): `server-hosted.cjs`
 * must not carry remote access (DuckDNS, ACME, UPnP/SSDP - the only outbound code besides SMTP) or the
 * Android `express-shim`. This is the ONE list both scripts/build-hosted.mjs (refuses to write such a
 * bundle) and scripts/hosted/stage-image.mjs (refuses to stage one) use.
 *
 * The markers are strings only the code under server/src/remote/** and mobile/core/express-shim contains:
 * the DuckDNS update API host, the two ACME directory hosts, the SSDP multicast address and search target,
 * and the shim's module name. The plan's literal `duckdns.org` / `letsencrypt.org` are NOT usable as
 * markers: the i18n catalogues (shared/i18n/messages/<locale>/*.ts) name `yourpersonaldiary.duckdns.org`
 * and Let's Encrypt in the remote-access help texts of every locale, and those catalogues ship in every
 * bundle - the desktop one, the Android core and the hosted one alike. A bare-substring list therefore
 * fails every real hosted bundle (that is exactly what blocked `deploy.ps1` at the staging step).
 * server/test/hosted-bundle-audit.test.ts asserts both properties: no marker occurs in the catalogues,
 * and every marker occurs in the remote-access / shim sources it stands for.
 */

/** Strings that must never appear in the hosted bundle (code-only markers - see above). */
export const FORBIDDEN_BUNDLE_STRINGS = Object.freeze([
  'www.duckdns.org',
  'acme-v02.api.letsencrypt.org',
  'acme-staging-v02.api.letsencrypt.org',
  '239.255.255.250',
  'ssdp:discover',
  'express-shim',
]);

/**
 * The forbidden strings `text` contains, in list order (empty when the bundle is clean).
 * @param {string} text the bundle's text (any single-byte-safe decoding - the markers are ASCII)
 * @returns {string[]}
 */
export function forbiddenStringsIn(text) {
  return FORBIDDEN_BUNDLE_STRINGS.filter((s) => text.includes(s));
}

// The operator tool (docs/HOSTED-PLAN.md 5.8 rule 4b, docs/android-tasks/ADMIN-TOOL.md item 2) ----------

/** File name of the operator tool next to the hosted bundle and in the image (/app/admin.cjs). */
export const ADMIN_TOOL_FILE = 'admin.cjs';
/** The one host the operator tool may address. */
export const ADMIN_TOOL_HOST = '127.0.0.1';
/** Node modules that can reach another host; the tool may require only node:http (plus fs and path). */
const ADMIN_FORBIDDEN_MODULES = ['https', 'http2', 'net', 'tls', 'dgram', 'dns', 'child_process', 'undici', 'ws', 'axios', 'node-fetch', 'got'];

/**
 * The problems of a built admin.cjs (empty when it is clean): scripts/build-hosted.mjs refuses to write
 * such a tool and scripts/hosted/stage-image.mjs to stage it. admin.cjs is the one HTTP client of the
 * image and may address 127.0.0.1 only - the loopback admin API of the server it runs next to:
 *   - every http(s) URL in it names 127.0.0.1;
 *   - every `host` / `hostname` option given as a literal is '127.0.0.1';
 *   - every IPv4 literal is 127.0.0.1, and the name of the loopback host is never spelled as a word
 *     (it can resolve elsewhere);
 *   - it loads no other network module (https, net, tls, dgram, dns, ...) and calls no fetch() / WebSocket;
 *   - it contains 127.0.0.1 at all (a tool that addresses nothing is not this tool).
 * @param {string} text the bundle's text
 * @returns {string[]}
 */
export function adminBundleProblems(text) {
  const problems = [];
  for (const m of text.matchAll(/\b(https?):\/\/([^/\s'"`:]+)/g)) {
    if (m[2] !== ADMIN_TOOL_HOST) problems.push(`addresses ${m[1]}://${m[2]} - only ${ADMIN_TOOL_HOST} is allowed`);
  }
  for (const m of text.matchAll(/\bhost(?:name)?\s*:\s*(['"`])([^'"`]*)\1/g)) {
    if (m[2] !== ADMIN_TOOL_HOST) problems.push(`host option "${m[2]}" - only ${ADMIN_TOOL_HOST} is allowed`);
  }
  for (const m of text.matchAll(/(?<![\w.])(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?![\w.])/g)) {
    if (m[1] !== ADMIN_TOOL_HOST) problems.push(`IP address ${m[1]} - only ${ADMIN_TOOL_HOST} is allowed`);
  }
  if (/\blocalhost\b/i.test(text)) problems.push(`names "localhost" - only the literal ${ADMIN_TOOL_HOST} is allowed`);
  for (const m of text.matchAll(/\brequire\(\s*(['"`])(?:node:)?([\w/-]+)\1\s*\)/g)) {
    if (ADMIN_FORBIDDEN_MODULES.includes(m[2])) problems.push(`loads the network module "${m[2]}"`);
  }
  if (/\bfetch\s*\(|\bnew\s+WebSocket\s*\(|\bEventSource\s*\(/.test(text)) problems.push('calls fetch() / WebSocket / EventSource');
  if (!text.includes(ADMIN_TOOL_HOST)) problems.push(`does not address ${ADMIN_TOOL_HOST} at all`);
  return [...new Set(problems)];
}
