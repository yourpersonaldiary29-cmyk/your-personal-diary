/**
 * The per-boot admin token of a hosted server (docs/HOSTED-PLAN.md 3.10, docs/android-tasks/ADMIN-TOOL.md
 * item 1): the second credential of the loopback admin API (routes/admin.ts), next to the loopback socket.
 *
 * At every start the hosted composition (hosted.ts) draws 32 random bytes and writes them, with the port
 * the server listens on, to `<dataDir>/.admin-token` (DIARY_ADMIN_TOKEN_FILE overrides the place):
 *
 *   {"version":1,"port":8080,"token":"<64 hex>","pid":123,"startedAt":"2026-10-28T12:00:00.000Z"}
 *
 * created fresh with mode 0600 (owner read/write only - the server's own user; root in a
 * `flyctl ssh console` shell reads it too) and renamed over the previous one, so every boot rotates the
 * token and a stale copy (a crash, a volume snapshot, an earlier boot) opens nothing. The server keeps
 * only the SHA-256 of the token in memory and compares in constant time. On a clean stop the file is
 * removed again (when it still holds this boot's token). The server archive leaves the file out
 * (hosted/archive.ts).
 *
 * The one reader is the operator tool, scripts/hosted/admin.ts (/app/admin.cjs): it needs a shell
 * inside the container - the owner's Fly login - to read the file at all. A thief of the owner's app
 * password reaches neither the file nor the loopback socket.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** File name of the token inside the data directory (the CLI's default: /data/.admin-token). */
export const ADMIN_TOKEN_FILE_NAME = '.admin-token';
/** Format version of the token file. */
export const ADMIN_TOKEN_FILE_VERSION = 1;
/** The request header that carries the token (scripts/hosted/admin.ts sends it). */
export const ADMIN_TOKEN_HEADER = 'x-admin-token';
/** A token is 32 random bytes as 64 lower-case hex characters. */
export const ADMIN_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/** What the token file holds (JSON, one line). */
export interface AdminTokenFileContent {
  version: number;
  /** The port the server listens on (the CLI connects to 127.0.0.1:<port>). */
  port: number;
  /** 64 hex characters. */
  token: string;
  pid: number;
  startedAt: string;
}

/** Where the token file goes: `DIARY_ADMIN_TOKEN_FILE` when set, else `<dataDir>/.admin-token`. */
export function adminTokenPath(dataDir: string, override?: string): string {
  return override && override.trim() ? path.resolve(override.trim()) : path.join(dataDir, ADMIN_TOKEN_FILE_NAME);
}

function digest(text: string): Buffer {
  return createHash('sha256').update(text, 'utf8').digest();
}

export class AdminToken {
  /** SHA-256 of the current token; null until `issue` wrote the file (and again after `revoke`). */
  private current: Buffer | null = null;

  constructor(readonly file: string) {}

  /** True while a token of this boot is in force. */
  get active(): boolean {
    return this.current !== null;
  }

  /**
   * Draws a new token and writes the file for `port` - a new file created with mode 0600, then renamed
   * over the old one (atomic: a reader sees the old file or the new one, never half of it). Throws when
   * the file cannot be written; the admin API then answers nobody until the next start.
   */
  issue(port: number, now: Date = new Date()): void {
    const token = randomBytes(32).toString('hex');
    const content: AdminTokenFileContent = { version: ADMIN_TOKEN_FILE_VERSION, port, token, pid: process.pid, startedAt: now.toISOString() };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    // Never reuse a temporary file somebody else may have created with a wider mode: a new one, 0600.
    fs.rmSync(tmp, { force: true });
    const fd = fs.openSync(tmp, 'w', 0o600);
    try {
      fs.writeSync(fd, `${JSON.stringify(content)}\n`, null, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    try {
      fs.renameSync(tmp, this.file);
    } catch (e) {
      fs.rmSync(tmp, { force: true });
      throw e;
    }
    // The mode of the created file already is 0600 (less with a stricter umask); this only repeats it.
    try {
      fs.chmodSync(this.file, 0o600);
    } catch {
      /* Windows development machines: permissions are ACLs there */
    }
    this.current = digest(token);
  }

  /** True when `presented` is this boot's token (constant time; false for anything else, and before `issue`). */
  verify(presented: unknown): boolean {
    const current = this.current;
    if (!current || typeof presented !== 'string' || !ADMIN_TOKEN_PATTERN.test(presented)) return false;
    return timingSafeEqual(digest(presented), current);
  }

  /**
   * Forgets the token (nothing verifies any more) and removes the file when it still holds this boot's
   * token - a newer server's file is left alone. Best effort; never throws.
   */
  revoke(): void {
    const current = this.current;
    this.current = null;
    if (!current) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<AdminTokenFileContent>;
      if (typeof parsed.token === 'string' && ADMIN_TOKEN_PATTERN.test(parsed.token) && timingSafeEqual(digest(parsed.token), current)) {
        fs.rmSync(this.file, { force: true });
      }
    } catch {
      /* gone already, or not ours */
    }
  }
}
