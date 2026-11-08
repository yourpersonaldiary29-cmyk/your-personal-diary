/**
 * The two commands of the Server card's "Deletion request by e-mail" helper (DeletionRequest.tsx,
 * docs/android-tasks/ADMIN-TOOL.md item 3). They are built HERE, in the app, from what the owner
 * types: nothing is sent to the server, and nothing in the app can look up, list or delete accounts.
 * They run the operator tool /app/admin.cjs inside the server's machine through the owner's own
 * flyctl - his Fly login is what lets them in - in the exact form the tool itself prints
 * (scripts/hosted/admin.ts `powershellLine`, tested in Windows PowerShell 5.1):
 *
 *   C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs find dana@example.com'
 *   C:\Users\AVI\.fly\bin\flyctl.exe ssh console -a yourpersonaldiary -C 'node /app/admin.cjs delete --email dana@example.com --confirm dana'
 *
 * Quoting: the whole -C command goes in single quotes and holds nothing that PowerShell or the
 * machine's command line would change. An address with any other character than letters and digits
 * (any script) and `. _ % + = @ -` - an apostrophe, `$`, quotes, spaces... - goes as
 * `b64:<base64url of its UTF-8, no padding>`, which the tool decodes (`decodeValue`); so does an
 * address that starts with "-", which the tool would otherwise read as an option. A username needs
 * nothing (the username rule allows letters, digits, `_ . -` and Hebrew only); one that starts with
 * "--" is given as `--confirm=<username>` for the same reason.
 *
 * The Fly app is the one serving this card - `<app>` of a `https://<app>.fly.dev` public address
 * (the staging server names `yourpersonaldiary-staging`) - else the production app, just as the
 * archive's download command names the machine's own app.
 *
 * Kept in step with the tool by src/pages/settings/adminCommands.test.ts, which runs the tool's own
 * functions on the same input.
 */
import { USERNAME_PATTERN } from '@shared/constants';

/** The owner's flyctl (server/src/hosted/archive.ts and scripts/hosted/admin.ts use the same full path). */
export const FLYCTL_WINDOWS_PATH = 'C:\\Users\\AVI\\.fly\\bin\\flyctl.exe';
/** The production Fly app (deploy/hosted/fly.toml). */
export const DEFAULT_FLY_APP = 'yourpersonaldiary';
/** How the operator tool is called inside the machine. */
export const ADMIN_TOOL = 'node /app/admin.cjs';
/** Prefix of an encoded value (the tool's `B64_PREFIX`). */
export const B64_PREFIX = 'b64:';

/** The Fly app behind `publicUrl` (`https://<app>.fly.dev`), else the production app. */
export function flyAppOf(publicUrl: string | null | undefined): string {
  if (publicUrl) {
    try {
      const match = /^([a-z0-9][a-z0-9-]*)\.fly\.dev$/.exec(new URL(publicUrl).hostname.toLowerCase());
      if (match) return match[1];
    } catch {
      // Not an address: the production app.
    }
  }
  return DEFAULT_FLY_APP;
}

/**
 * True when `value` can go into the one-line command as it is: letters and digits of any script and
 * `. _ % + = @ -` only (the tool's `isPlainValue`).
 */
export function isPlainValue(value: string): boolean {
  return /^[\p{L}\p{M}\p{N}._%+=@-]+$/u.test(value);
}

/** UTF-8 bytes of `text`; a lone surrogate becomes U+FFFD, as in Node's Buffer.from(text, 'utf8'). */
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00);
        i++;
      } else {
        cp = 0xfffd;
      }
    } else if (cp >= 0xd800 && cp <= 0xdfff) {
      cp = 0xfffd;
    }
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return bytes;
}

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url without padding (Node's `toString('base64url')`). */
function base64Url(bytes: readonly number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : -1;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : -1;
    out += BASE64URL[b0 >> 2];
    out += BASE64URL[((b0 & 0x03) << 4) | (b1 < 0 ? 0 : b1 >> 4)];
    if (b1 >= 0) out += BASE64URL[((b1 & 0x0f) << 2) | (b2 < 0 ? 0 : b2 >> 6)];
    if (b2 >= 0) out += BASE64URL[b2 & 0x3f];
  }
  return out;
}

/** The `b64:` form of `value` (the tool's `encodeValue`). */
export function encodeValue(value: string): string {
  return `${B64_PREFIX}${base64Url(utf8Bytes(value))}`;
}

/** An e-mail address as it goes into the commands: as it is when that is safe, else its `b64:` form. */
export function addressArgument(email: string): { value: string; encoded: boolean } {
  if (isPlainValue(email) && !email.startsWith('-')) return { value: email, encoded: false };
  return { value: encodeValue(email), encoded: true };
}

/** True for a username as the app allows it (shared USERNAME_PATTERN). */
export function isUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

/** `--confirm <username>` - or `--confirm=<username>` for one that starts with "--". */
export function confirmOption(username: string): string {
  return username.startsWith('--') ? `--confirm=${username}` : `--confirm ${username}`;
}

/**
 * `inside` (run in the machine) as one line for Windows PowerShell: <flyctl> ssh console -a <app> -C
 * '<inside>' - single quotes, a quote inside doubled (never needed: the values above hold none).
 */
export function powershellLine(app: string, inside: string): string {
  return `${FLYCTL_WINDOWS_PATH} ssh console -a ${app} -C '${inside.replace(/'/g, "''")}'`;
}

/** Step 1: the account with exactly this address - shown, nothing changed. */
export function findCommand(app: string, email: string): string {
  return powershellLine(app, `${ADMIN_TOOL} find ${addressArgument(email).value}`);
}

/** Step 2: delete the account with this address, confirmed with its username exactly. */
export function deleteCommand(app: string, email: string, username: string): string {
  return powershellLine(app, `${ADMIN_TOOL} delete --email ${addressArgument(email).value} ${confirmOption(username)}`);
}
