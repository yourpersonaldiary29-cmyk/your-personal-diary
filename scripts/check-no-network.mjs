/**
 * Static audit: proves that neither the frontend, the server, the Android host/core code
 * (mobile/) nor the Android app's native code (android/app/src/main/java|kotlin) contains code
 * that talks to the internet. It scans the source trees for outbound-network primitives and
 * external URLs and fails if any are found outside the allow-list below. mobile/ gets the same
 * rules as the frontend and has no allow-list entry; the Java/Kotlin sources get JVM rules on top,
 * and the Android manifest may declare only the permissions in ALLOWED_ANDROID_PERMISSIONS.
 *
 * The exceptions (all opt-in, off by default):
 *   - REMOTE ACCESS: the code in server/src/remote/ may contact exactly the hosts in REMOTE_HOSTS
 *     (DuckDNS and Let's Encrypt) and the home router on the local network (UPnP) - and it runs
 *     only while the owner has remote access turned on or presses "Test connection". Network
 *     client modules (node:https, node:dgram) may be imported only there.
 *   - SENDING E-MAIL (password reset): the SMTP client in server/src/mail/ may open a TCP / TLS
 *     connection (node:net, node:tls) to the SMTP host the owner configured - and only while mail
 *     is enabled, when an e-mail is sent. It contains no URL and no HTTP client: no host is
 *     hard-coded except the suggested default name 'smtp.gmail.com' of the settings form.
 *   - THE DISK BUTTON of the hosted server's Server card (docs/server-tasks/SERVER-CARD-V2.md B2):
 *     the ONE file FLY_FILE may import node:https (no other network module), call https.request
 *     in one place, with new URL(<the URL it checked>) and no host of its own, and name exactly
 *     https://api.machines.dev (the Fly Machines API; no other URL, no plain http, no URL built from
 *     pieces, node:https never handed on) - and it runs only while the owner set up the button (the
 *     secret DIARY_FLY_API_TOKEN). No other scanned file may name that host in code.
 *
 * Usage: node scripts/check-no-network.mjs                 (exit code 1 on violations)
 *        node scripts/check-no-network.mjs --root=<dir>    (audit another tree: the script's own tests)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminBundleProblems } from './hosted/bundle-audit.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootArg = process.argv.slice(2).find((arg) => arg.startsWith('--root='));
const root = rootArg ? path.resolve(rootArg.slice('--root='.length)) : path.resolve(__dirname, '..');

// mobile/: the Android host and core sources. android/app/src/main/java|kotlin: the native code of
// the Android app (Capacitor's generated MainActivity and, later, local plugins - WP-12 adds the
// allow-list entry for the mail plugin). Build outputs (dist/, mobile-dist/, android/**/build) and
// the copied web assets are not sources and are not scanned; directories named like a build output
// or 'test' are skipped inside the scanned trees too.
const SCAN_DIRS = ['src', 'server/src', 'shared', 'src-tauri/src', 'mobile', 'android/app/src/main/java', 'android/app/src/main/kotlin'];
const SKIP = new Set(['node_modules', 'dist', 'mobile-dist', 'target', '.dev-data', 'test', 'build']);
const EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.rs', '.mjs', '.cjs', '.js', '.jsx', '.java', '.kt']);
const JVM_FILE = /\.(?:java|kt)$/;

/**
 * Android native code: nothing in the app's Java / Kotlin may open a network connection. The rules
 * cover the ways a socket is reached without the fully-qualified name appearing in the source:
 *   - wildcard imports of the network packages (`import java.net.*;`, `import javax.net.ssl.*`),
 *   - the unqualified network classes themselves (imported one by one or through a wildcard),
 *   - constructor calls, Java `new Socket(` and Kotlin `Socket(` / `URL(`,
 *   - typed declarations and parameters (`Socket s = ...`, `val s: Socket`),
 *   - factory / connection calls that never name the class: `SocketFactory.getDefault().createSocket(...)`,
 *     `url.openConnection()`, `url.openStream()`.
 * The first matching rule reports a line. Reflection with a computed class name cannot be seen
 * statically - such code has no place in this app. The only legitimate exception is the SMTP plugin of
 * a later package (WP-12), which lists its file(s) in JVM_ALLOWED with the rules it may trigger.
 */
const JVM_FORBIDDEN = [
  { re: /\bimport\s+(?:static\s+)?(?:java\.net|javax\.net|java\.nio\.channels|android\.net\.http|org\.apache\.http)(?:\.\w+)*\.\*/g, why: 'wildcard import of a network package' },
  { re: /\bjava\.net\.(?:Socket|ServerSocket|SocketImpl|URL|URLConnection|JarURLConnection|HttpURLConnection|DatagramSocket|MulticastSocket|InetAddress|Inet4Address|Inet6Address|InetSocketAddress|Proxy|ProxySelector|http)\b/g, why: 'Java network class' },
  { re: /\bjava\.nio\.channels\.(?:Socket|ServerSocket|Datagram|AsynchronousSocket|AsynchronousServerSocket)Channel\b/g, why: 'Java network class' },
  { re: /\bjavax\.net\b/g, why: 'Java TLS socket' },
  { re: /\bokhttp3?\b|\bretrofit2?\b|\bio\.ktor\b|\bcom\.android\.volley\b|\bandroid\.net\.http\b|\borg\.apache\.http\b|\bcom\.squareup\b/g, why: 'HTTP client library' },
  { re: /\bHttps?URLConnection\b|\bJarURLConnection\b|\bURLConnection\b|\bHttpClient\b|\bWebSocket\b|\bDownloadManager\b/g, why: 'HTTP client' },
  { re: /\b(?:new\s+)?(?:Socket|ServerSocket|DatagramSocket|MulticastSocket|SSLSocket|URL)\s*\(/g, why: 'network connection' },
  { re: /\bcreateSocket\s*\(|\bopenConnection\s*\(|\bopenStream\s*\(/g, why: 'socket factory / connection call' },
  { re: /\b(?:ServerSocket|DatagramSocket|MulticastSocket|SocketChannel|ServerSocketChannel|DatagramChannel|AsynchronousSocketChannel|AsynchronousServerSocketChannel|SocketFactory|ServerSocketFactory|SSLSocketFactory|SSLServerSocketFactory|SSLSocket|SSLServerSocket|SSLContext|SSLEngine|InetAddress|Inet4Address|Inet6Address|InetSocketAddress)\b/g, why: 'network class' },
  { re: /\b(?:Socket|URL)(?:<[^>]*>)?\s+\w+\s*[=;,)]|\w\s*:\s*(?:Socket|URL)\b/g, why: 'network object' },
];
/**
 * Per-file exceptions for the native code: relative path -> the `why` values that file may trigger.
 * Empty today. WP-12 adds its SMTP plugin here, e.g.
 *   ['android/app/src/main/java/com/mydiary/app/mail/DiaryMailPlugin.java',
 *    new Set(['Java TLS socket', 'network class', 'network connection', 'network object', 'socket factory / connection call'])]
 * - never 'HTTP client', 'HTTP client library' or 'wildcard import of a network package'.
 */
const JVM_ALLOWED = new Map([]);

/**
 * The Android manifest may declare exactly these permissions. INTERNET stays for the e-mail plugin of
 * WP-12 (the WebView itself is confined by the CSP). A package that needs another permission adds it
 * here together with the manifest - deliberately. WP-7/8/9 added POST_NOTIFICATIONS and
 * RECEIVE_BOOT_COMPLETED (habit reminders as system notifications, re-armed after a reboot) and
 * USE_BIOMETRIC (the BiometricPrompt of the lock screen). A <uses-permission tools:node="remove">
 * entry REMOVES a permission a library declared (SCHEDULE_EXACT_ALARM, WAKE_LOCK) - no declaration.
 */
const ANDROID_MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const ALLOWED_ANDROID_PERMISSIONS = new Set([
  'android.permission.INTERNET',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.USE_BIOMETRIC',
]);
/** Test files sit next to the frontend sources; like server/test they are never shipped. */
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/** Patterns that indicate outbound network activity. */
const FORBIDDEN = [
  { re: /\bhttps?:\/\/(?!127\.0\.0\.1|localhost|tauri\.localhost|ipc\.localhost|schema\.tauri\.app)[\w.-]+/g, why: 'external URL' },
  { re: /\brequire\(\s*['"`](https?|axios|node-fetch|got|undici|ws)['"`]\s*\)/g, why: 'outbound HTTP client' },
  { re: /\bfrom\s+['"](axios|node-fetch|got|undici|ws|socket\.io-client)['"]/g, why: 'outbound HTTP client' },
  { re: /\bhttps\.request\(|\bhttps\.get\(/g, why: 'https client call' },
  { re: /\bnavigator\.sendBeacon\b/g, why: 'beacon' },
  { re: /\breqwest\b|\bureq\b|\bhyper::Client\b/g, why: 'Rust HTTP client' },
  { re: /tauri-plugin-(http|updater)/g, why: 'network plugin' },
];

/**
 * Lines allowed to mention URLs (documentation strings, CSP directives, CORS allow-list). The source scan
 * (scan() below) skips a line that starts with `*` only inside a block comment - a line of a template literal
 * or of a multi-line expression may start with `*` too; the other rules apply to it as they are.
 */
const STAR_LINE = /^\s*\*/;
const ALLOW_CODE_LINE = [/schema\.tauri\.app/, /^\s*\/\//, /Content-Security-Policy/, /ALLOWED_ORIGINS/, /\/\/!/];
const ALLOW_LINE = [...ALLOW_CODE_LINE, STAR_LINE];

/** Whether a block comment is still open after `line`, given whether one was open before it. */
function blockCommentOpenAfter(line, open) {
  let pos = 0;
  for (;;) {
    if (open) {
      const end = line.indexOf('*/', pos);
      if (end < 0) return true;
      open = false;
      pos = end + 2;
    } else {
      const start = line.indexOf('/*', pos);
      if (start < 0) return false;
      const lineComment = line.indexOf('//', pos);
      if (lineComment >= 0 && lineComment < start) return false;
      open = true;
      pos = start + 2;
    }
  }
}

/** A quoted module name: '...', "..." or `...`. */
const Q = '[\'"`]';
/**
 * The ways a module is loaded by its name: `from '<m>'` (static import and re-export), require('<m>'),
 * import('<m>') (not `typeof import(...)`, a type), process.getBuiltinModule('<m>') and createRequire(...)('<m>').
 * `\s` spans line breaks, so the same pattern also finds a load split over several lines in the joined code.
 */
function moduleLoads(modules, { fromForm = modules, dynamic = true } = {}) {
  const name = (list) => `${Q}(?:node:)?(?:${list})${Q}`;
  const forms = [];
  if (fromForm) forms.push(`\\bfrom\\s+${name(fromForm)}`);
  if (dynamic) {
    forms.push(
      `\\brequire\\s*\\(\\s*${name(modules)}`,
      `(?<!typeof\\s*)\\bimport\\s*\\(\\s*${name(modules)}`,
      `\\bgetBuiltinModule\\s*\\(\\s*${name(modules)}`,
      `\\bcreateRequire\\s*\\([^)]*\\)\\s*\\(\\s*${name(modules)}`,
    );
  }
  return new RegExp(forms.join('|'), 'g');
}

/** Remote access: the only directory with outbound code, and the only hosts it may contact. */
const REMOTE_DIR = 'server/src/remote/';
const REMOTE_HOSTS = ['acme-v02.api.letsencrypt.org', 'acme-staging-v02.api.letsencrypt.org', 'www.duckdns.org'];
/** Matches exactly `https://<allowed host>` followed by a path, a quote or the end. */
const REMOTE_URL = new RegExp(`\\bhttps://(?:${REMOTE_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|')})(?=[/'"\`\\s]|$)`, 'g');
/** XML namespace identifiers: names written into markup, never fetched. */
const XML_NAMESPACES = [
  'http://www.w3.org/2000/svg',
  'http://schemas.xmlsoap.org/soap/envelope/',
  'http://schemas.xmlsoap.org/soap/encoding/',
];
/** Outbound-capable modules that only the remote-access code may load (in any of the forms of moduleLoads()). */
const NETWORK_MODULES = moduleLoads('https|http2|dgram|dns|tls');
/**
 * Outbound calls of the Node.js core modules (the server listens with node:http / node:net, but
 * only the remote-access code may connect out). Checked in server/src and shared/ outside
 * server/src/remote/; the frontend's fetch() talks to its own local server only. A socket built with
 * `new Socket(...)` and the connecting functions imported by name count as well.
 */
const SERVER_OUTBOUND =
  /\bfetch\(|\bhttp\.(?:request|get)\(|\bnet\.(?:connect|createConnection)\(|\btls\.connect\(|\bnew\s+WebSocket\(|\bnew\s+(?:net\.|tls\.)?(?:Socket|TLSSocket)\s*\(|\bimport\s*\{[^}]*\b(?:connect|createConnection|request|get|Agent|Socket|TLSSocket)\b[^}]*\}\s*from\s*['"`](?:node:)?(?:net|http|tls)['"`]/g;
const SERVER_DIRS = ['server/src/', 'shared/'];

/**
 * Sending e-mail: the SMTP client may import node:tls and open TCP / TLS connections (to the SMTP
 * host from the owner's settings) - nothing else: no HTTP, no DNS module, no UDP, no URL.
 */
const MAIL_DIR = 'server/src/mail/';
/** What the mail code may still not import (everything outbound-capable except node:tls / node:net). */
const MAIL_FORBIDDEN_MODULES = moduleLoads('https|http|http2|dgram|dns');
/** Outbound calls the mail code may not make (it only uses net.connect / tls.connect). */
const MAIL_FORBIDDEN_CALLS = /\bfetch\(|\bhttps?\.(?:request|get)\(|\bnew\s+WebSocket\(/g;

/**
 * The disk button: the Fly Machines API client of the hosted server. Exactly this file, exactly this
 * host over https, with node:https only - no fetch, no node:http / http2 / net / tls / dgram / dns.
 */
export const FLY_FILE = 'server/src/hosted/fly-volume.ts';
export const FLY_HOST = 'api.machines.dev';
/** Matches exactly `https://api.machines.dev` followed by a path, a quote or the end (not `.evil.example`). */
const FLY_URL = /\bhttps:\/\/api\.machines\.dev(?=[/'"`\s]|$)/g;
/** What the Fly module may still not import: every network module except node:https (and that one statically only). */
const FLY_FORBIDDEN_MODULES = moduleLoads('https?|http2|net|tls|dgram|dns', { fromForm: 'http|http2|net|tls|dgram|dns' });
/**
 * The host anywhere else (any case, with or without a scheme, or half of it): only FLY_FILE may name it. A line
 * is checked after hostNamePieces() joined adjacent string pieces and turned escaped dots back into dots.
 */
const FLY_HOST_NAMED = /api\.machines|machines\.dev/i;
function hostNamePieces(line) {
  return line.replace(/\\x2e|\\u002e|\\u\{0*2e\}/gi, '.').replace(/['"`]\s*\+\s*['"`]/g, '');
}
/**
 * The ways the Fly module could still reach another host with the one https.request it may make: its URL
 * literal is checked, so the target must come from nowhere else - no other member of node:https (get, Agent,
 * ...), no host / port / socket of its own in an options object, no URL built from pieces, and node:https never
 * handed on to another module (a re-export). Its one call takes `new URL(<variable>)`, which the module's own
 * guard checks before the call (isFlyApiUrl in nodeFlyHttp).
 */
const FLY_RULES = [
  { re: /\bhttps\.(?!request\()[A-Za-z_$]|\bhttps\s*\[|\bhttps\s*\?\./g, why: 'the Fly API module may use node:https only for https.request' },
  { re: /\b(?:host|hostname|port|socketPath|lookup|createConnection|servername)\s*:/g, why: 'the Fly API module may not name a target of its own' },
  {
    re: /\bhttps?:\/\/(?![\w.-])|['"`]https?:\/{0,2}['"`]\s*\+|\+\s*['"`]\/\/|['"`]\/\/[\w.-]|\.join\(\s*['"`]\/['"`]\s*\)/g,
    why: 'the Fly API module may not build a URL from pieces',
  },
  { re: /\bexport\b[^;]*\bfrom\s+['"](?:node:)?https['"]|\bexport\s+(?:default\s+https\b|\{[^}]*\bhttps\b)/g, why: 'the Fly API module may not hand node:https on' },
];
/** Its one call: https.request(new URL(<variable>), ...). */
const FLY_REQUEST = /\bhttps\.request\(/g;
const FLY_REQUEST_FORM = /\bhttps\.request\(\s*new\s+URL\(\s*[\w$.]+\s*\)\s*,/;

const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (EXT.has(path.extname(name)) && !TEST_FILE.test(name)) scan(full);
  }
}

function scan(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const rel = path.relative(root, file).split(path.sep).join('/');
  const isRemote = rel.startsWith(REMOTE_DIR);
  const isMail = rel.startsWith(MAIL_DIR);
  const isFly = rel === FLY_FILE;
  const isJvm = JVM_FILE.test(rel);
  let flyRequests = 0;
  let inBlockComment = false;
  /** The code lines the rules below look at, joined again: for the module loads split over several lines. */
  const codeLines = [];
  /** The module rule of this file, and whether a single line already broke it. */
  const moduleRule = isRemote ? null : isFly ? FLY_FORBIDDEN_MODULES : isMail ? MAIL_FORBIDDEN_MODULES : NETWORK_MODULES;
  let moduleRuleHit = false;
  lines.forEach((raw, i) => {
    const commentLine = inBlockComment && STAR_LINE.test(raw);
    inBlockComment = blockCommentOpenAfter(raw, inBlockComment);
    if (commentLine || ALLOW_CODE_LINE.some((re) => re.test(raw))) return;
    codeLines.push(raw);
    if (moduleRule) {
      moduleRule.lastIndex = 0;
      if (moduleRule.test(raw)) moduleRuleHit = true;
    }
    let line = raw;
    for (const ns of XML_NAMESPACES) line = line.split(ns).join('');
    if (isJvm) {
      const allowed = JVM_ALLOWED.get(rel);
      for (const { re, why } of JVM_FORBIDDEN) {
        if (allowed && allowed.has(why)) continue;
        re.lastIndex = 0;
        if (re.test(line)) {
          violations.push(`${rel}:${i + 1}: ${why} in Android native code: ${raw.trim().slice(0, 120)}`);
          break;
        }
      }
    }
    if (!isFly && FLY_HOST_NAMED.test(hostNamePieces(line))) {
      violations.push(`${rel}:${i + 1}: the Fly API host ${FLY_HOST} may be named only in ${FLY_FILE}: ${raw.trim().slice(0, 120)}`);
    }
    if (isRemote) {
      REMOTE_URL.lastIndex = 0;
      line = line.replace(REMOTE_URL, '');
    } else if (isFly) {
      FLY_FORBIDDEN_MODULES.lastIndex = 0;
      if (FLY_FORBIDDEN_MODULES.test(line)) {
        violations.push(`${rel}:${i + 1}: the Fly API module may only import node:https: ${raw.trim().slice(0, 120)}`);
      }
      SERVER_OUTBOUND.lastIndex = 0;
      if (SERVER_OUTBOUND.test(line)) {
        violations.push(`${rel}:${i + 1}: the Fly API module may only call https.request: ${raw.trim().slice(0, 120)}`);
      }
      FLY_URL.lastIndex = 0;
      line = line.replace(FLY_URL, '');
      for (const { re, why } of FLY_RULES) {
        re.lastIndex = 0;
        if (re.test(line)) violations.push(`${rel}:${i + 1}: ${why}: ${raw.trim().slice(0, 120)}`);
      }
      FLY_REQUEST.lastIndex = 0;
      const calls = line.match(FLY_REQUEST)?.length ?? 0;
      flyRequests += calls;
      if (calls && !FLY_REQUEST_FORM.test(line)) {
        violations.push(`${rel}:${i + 1}: the Fly API module's https.request must take new URL(<the checked URL>): ${raw.trim().slice(0, 120)}`);
      }
    } else if (isMail) {
      MAIL_FORBIDDEN_MODULES.lastIndex = 0;
      if (MAIL_FORBIDDEN_MODULES.test(line)) {
        violations.push(`${rel}:${i + 1}: the mail code may only use node:net / node:tls: ${raw.trim().slice(0, 120)}`);
      }
      MAIL_FORBIDDEN_CALLS.lastIndex = 0;
      if (MAIL_FORBIDDEN_CALLS.test(line)) {
        violations.push(`${rel}:${i + 1}: outbound HTTP in the mail code: ${raw.trim().slice(0, 120)}`);
      }
    } else {
      NETWORK_MODULES.lastIndex = 0;
      if (NETWORK_MODULES.test(line)) {
        violations.push(`${rel}:${i + 1}: network client module outside ${REMOTE_DIR}: ${raw.trim().slice(0, 120)}`);
      }
      SERVER_OUTBOUND.lastIndex = 0;
      if (SERVER_DIRS.some((d) => rel.startsWith(d)) && SERVER_OUTBOUND.test(line)) {
        violations.push(`${rel}:${i + 1}: outbound connection outside ${REMOTE_DIR}: ${raw.trim().slice(0, 120)}`);
      }
    }
    for (const { re, why } of FORBIDDEN) {
      // The remote-access client itself (https requests to the hosts above, http to the LAN router), and
      // the Fly API client (https requests to its one host).
      if ((isRemote || isFly) && why === 'https client call') continue;
      re.lastIndex = 0;
      if (re.test(line)) {
        violations.push(`${rel}:${i + 1}: ${why}: ${raw.trim().slice(0, 120)}`);
      }
    }
  });
  if (isFly && flyRequests > 1) violations.push(`${rel}: the Fly API module may call https.request in one place only (found ${flyRequests})`);
  // A module load split over several lines (`import(\n  'node:https'\n)`), which no single line shows.
  if (moduleRule && !moduleRuleHit) {
    moduleRule.lastIndex = 0;
    const split = moduleRule.exec(codeLines.join('\n'));
    if (split) violations.push(`${rel}: a network module loaded over several lines: ${split[0].replace(/\s+/g, ' ').slice(0, 120)}`);
  }
}

for (const d of SCAN_DIRS) {
  const full = path.join(root, d);
  try {
    if (statSync(full).isDirectory()) walk(full);
  } catch {
    /* missing dir */
  }
}

// Android manifest audit: no permission beyond the allow-list (the merged manifest of the APK is
// checked again by scripts/android/verify-apk.ps1 after a build).
try {
  const manifest = readFileSync(path.join(root, ANDROID_MANIFEST), 'utf8');
  for (const [element] of manifest.matchAll(/<uses-permission(?:-sdk-23)?\s[^>]*>/g)) {
    const name = /android:name="([^"]+)"/.exec(element)?.[1];
    if (!name) continue;
    // A removal takes a library's permission OUT of the merged manifest; it declares nothing.
    if (/tools:node="remove"/.test(element)) continue;
    if (!ALLOWED_ANDROID_PERMISSIONS.has(name)) {
      violations.push(`${ANDROID_MANIFEST}: permission ${name} is not on the allow-list (a package that needs it adds it to ALLOWED_ANDROID_PERMISSIONS deliberately)`);
    }
  }
} catch {
  /* no Android project in this tree */
}

// Dependency audit: production deps must not include HTTP clients / telemetry SDKs.
const BANNED_DEPS = ['axios', 'node-fetch', 'got', 'undici', '@sentry/node', '@sentry/react', 'posthog-js', 'mixpanel', 'analytics'];
for (const pkgPath of ['package.json', 'server/package.json']) {
  const pkg = JSON.parse(readFileSync(path.join(root, pkgPath), 'utf8'));
  for (const dep of Object.keys(pkg.dependencies || {})) {
    if (BANNED_DEPS.includes(dep)) violations.push(`${pkgPath}: banned dependency ${dep}`);
  }
}

// Hosted image (docs/HOSTED-PLAN.md 5.8 rule 4): the Dockerfile and the scripts baked into the container
// fetch nothing - no curl / wget, no ADD <url>, no URL at all; the only package install is `apk add` from
// the base image's own repositories. The hosted server code under server/src is covered by the scans above
// with one allow-list entry (rule 1): FLY_FILE, the disk button's Fly API client, and its one host;
// scripts/build-hosted.mjs refuses to write, and scripts/hosted/stage-image.mjs to stage, a server-hosted.cjs that contains the code-only remote-access / shim markers of
// scripts/hosted/bundle-audit.mjs (rule 2; the plan's bare `duckdns.org` occurs in the i18n help texts).
const HOSTED_IMAGE_FILES = ['deploy/hosted/Dockerfile', 'deploy/hosted/entrypoint.sh', 'deploy/hosted/data-tools.sh'];
for (const relFile of HOSTED_IMAGE_FILES) {
  let text;
  try {
    text = readFileSync(path.join(root, relFile), 'utf8');
  } catch {
    continue; // not written yet
  }
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    if (/\b(?:curl|wget)\b/.test(line) || /^ADD\s/.test(line) || /\bhttps?:\/\//.test(line)) {
      violations.push(`${relFile}:${i + 1}: the hosted image may not fetch from the network: ${line.slice(0, 120)}`);
    }
  });
}

// Operator tools of hosted mode (5.8 rule 4b): scripts/hosted/admin.ts is the one HTTP client in the tree and
// may address exactly 127.0.0.1 (the loopback admin API inside the container, reached through `fly ssh
// console`); scripts/hosted/restore-archive.mjs opens no sockets at all. Both appear with WP-H8.
const HOSTED_TOOL_RULES = [
  { file: 'scripts/hosted/admin.ts', loopbackOnly: true },
  { file: 'scripts/hosted/restore-archive.mjs', loopbackOnly: false },
];
const SOCKET_MODULES = /\bfrom\s+['"](?:node:)?(?:http|https|http2|net|tls|dgram|dns)['"]|\brequire\(['"](?:node:)?(?:http|https|http2|net|tls|dgram|dns)['"]\)/;
for (const { file, loopbackOnly } of HOSTED_TOOL_RULES) {
  let text;
  try {
    text = readFileSync(path.join(root, file), 'utf8');
  } catch {
    continue;
  }
  text.split(/\r?\n/).forEach((raw, i) => {
    if (ALLOW_LINE.some((re) => re.test(raw))) return;
    const where = `${file}:${i + 1}`;
    const shown = raw.trim().slice(0, 120);
    if (!loopbackOnly) {
      SERVER_OUTBOUND.lastIndex = 0;
      if (SOCKET_MODULES.test(raw) || SERVER_OUTBOUND.test(raw)) violations.push(`${where}: this tool must open no sockets: ${shown}`);
    }
    for (const m of raw.matchAll(/\bhttps?:\/\/([\w.-]+)/g)) {
      if (!loopbackOnly || m[1] !== '127.0.0.1') violations.push(`${where}: only 127.0.0.1 may be addressed here: ${shown}`);
    }
    if (loopbackOnly && /\bhost\s*:\s*['"`](?!127\.0\.0\.1['"`])[^'"`]+['"`]/.test(raw)) violations.push(`${where}: only 127.0.0.1 may be addressed here: ${shown}`);
    if (/\blocalhost\b/.test(raw)) violations.push(`${where}: use the literal 127.0.0.1, never localhost: ${shown}`);
  });
}
// The BUILT operator tool, when present in the hand-over directories (scripts/build-hosted.mjs writes
// deploy/hosted/build/admin.cjs, scripts/hosted/stage-image.mjs stages deploy/hosted/dist/admin.cjs = /app/admin.cjs):
// the same check both scripts apply - it may address 127.0.0.1 only (scripts/hosted/bundle-audit.mjs).
for (const relFile of ['deploy/hosted/build/admin.cjs', 'deploy/hosted/dist/admin.cjs']) {
  let text;
  try {
    text = readFileSync(path.join(root, relFile), 'utf8');
  } catch {
    continue; // not built / not staged in this tree
  }
  for (const problem of adminBundleProblems(text)) violations.push(`${relFile}: the operator tool ${problem}`);
}

// The clients' default server address (5.8 rule 5, WP-H5): the ONE outbound host of the client bundle. It
// lives ONLY in src/config/server-default.json ({"url": "https://<host>"}) and reaches the bundles through
// the import in src/config/server-default.ts (the published Windows and Android apps are wired to it; the
// web UI served by that server uses its own origin). Rules:
//   (a) the file is required in the project (a --root tree without it skips the rule);
//   (b) it must be https://<host>[:port] with no path, query, fragment or credentials;
//   (c) that host may not be spelled as a literal in src/, mobile/ or shared/ (the CSP lines of the shells
//       are covered by ALLOW_LINE: `Content-Security-Policy`), so no second copy can drift;
//   (d) the built client bundle (dist/assets/*.js, when present) may name no other host on the internet:
//       the default host, loopback and the documentation links the libraries bake into their error
//       messages (DIST_ALLOWED_HOSTS - never fetched) are the complete list. A new dependency that phones
//       home, or a host sneaked in through a dependency, fails here even though it is not in the sources.
export const SERVER_DEFAULT_FILE = 'src/config/server-default.json';
/** Hosts a client bundle may mention besides the default server (library docs links; nothing is fetched from them). */
export const DIST_ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', 'www.w3.org', 'react.dev', 'reactrouter.com', 'github.com']);
/** The default server's host, or null when the file is absent / invalid (reported). */
function readDefaultServerHost() {
  let raw;
  try {
    raw = readFileSync(path.join(root, SERVER_DEFAULT_FILE), 'utf8');
  } catch {
    if (!rootArg) violations.push(`${SERVER_DEFAULT_FILE}: missing - the clients' default server address must live there (WP-H5)`);
    return null;
  }
  let url;
  try {
    const json = JSON.parse(raw);
    url = json && typeof json === 'object' ? json.url : undefined;
  } catch {
    violations.push(`${SERVER_DEFAULT_FILE}: not valid JSON`);
    return null;
  }
  let parsed = null;
  try {
    parsed = new URL(String(url));
  } catch {
    /* reported below */
  }
  if (!parsed || parsed.protocol !== 'https:' || !['', '/'].includes(parsed.pathname) || parsed.search || parsed.hash || parsed.username || parsed.password) {
    violations.push(`${SERVER_DEFAULT_FILE}: the default server address must be https://<host> with no path, query, fragment or credentials`);
    return null;
  }
  return parsed.host;
}
{
  const defaultHost = readDefaultServerHost();
  if (defaultHost) {
    const hostRe = new RegExp(`(?:^|[^\\w.-])${defaultHost.replace(/\./g, '\\.')}(?![\\w-])`, 'i');
    const walkHost = (dir) => {
      for (const name of readdirSync(dir)) {
        if (SKIP.has(name)) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walkHost(full);
        else if (EXT.has(path.extname(name)) && !TEST_FILE.test(name)) {
          readFileSync(full, 'utf8').split(/\r?\n/).forEach((line, i) => {
            if (hostRe.test(line) && !ALLOW_LINE.some((re) => re.test(line))) {
              violations.push(`${path.relative(root, full).split(path.sep).join('/')}:${i + 1}: the default server host comes from ${SERVER_DEFAULT_FILE}, never a literal: ${line.trim().slice(0, 120)}`);
            }
          });
        }
      }
    };
    for (const d of ['src', 'mobile', 'shared']) {
      try {
        if (statSync(path.join(root, d)).isDirectory()) walkHost(path.join(root, d));
      } catch {
        /* missing dir */
      }
    }
    // (d) the built bundle: every http(s) host it names must be the default server or on the allow-list.
    const assets = path.join(root, 'dist', 'assets');
    let bundleFiles = [];
    try {
      bundleFiles = readdirSync(assets).filter((name) => name.endsWith('.js'));
    } catch {
      /* no build in this tree */
    }
    for (const name of bundleFiles) {
      const hosts = new Set();
      for (const m of readFileSync(path.join(assets, name), 'utf8').matchAll(/https?:\/\/([\w.-]+(?::\d+)?)/g)) hosts.add(m[1].toLowerCase());
      for (const host of hosts) {
        if (host === defaultHost.toLowerCase() || DIST_ALLOWED_HOSTS.has(host)) continue;
        violations.push(`dist/assets/${name}: the client bundle names a host that is neither the default server nor on DIST_ALLOWED_HOSTS: ${host}`);
      }
    }
  }
}

if (violations.length) {
  console.error('❌ Network audit failed:\n' + violations.map((v) => '  ' + v).join('\n'));
  process.exit(1);
}
console.log(
  `✅ Network audit passed: no outbound network code or external URLs found (remote access in ${REMOTE_DIR} may contact only ${REMOTE_HOSTS.join(', ')} and the LAN router; the SMTP client in ${MAIL_DIR} only the mail server the owner configured; the disk button's ${FLY_FILE} only https://${FLY_HOST}; the Android native code opens no connections and the manifest declares only ${[...ALLOWED_ANDROID_PERMISSIONS].join(', ')}).`,
);
