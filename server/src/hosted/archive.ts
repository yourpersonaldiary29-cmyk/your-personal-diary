/**
 * The encrypted server archive of a hosted server (WP-H8; docs/android-tasks/SERVER-CARD.md item 2,
 * docs/HOSTED-PLAN.md 3.3). Built only by the hosted composition (hosted.ts): the desktop sidecar
 * and the Android core never carry it.
 *
 * `create(passphrase)` writes `<dataDir>/archive/your-personal-diary-server-<UTC>.mpda`:
 *
 *   a tar (ustar, PAX records for long names) of the data directory WITHOUT archive/, incoming/,
 *   logs/, tmp/, lost+found/, *.log, temporary files (*.tmp, *.temp, *.partial, *.swp, *~) and
 *   WITHOUT any device.key file and the admin token (.admin-token) - symbolic links and other non-regular files are skipped, never
 *   followed - encrypted in chunks with AES-256-GCM under a key derived from the passphrase with
 *   scrypt (the app's own KDF: N=2^15, r=8, p=1, 16-byte salt, 64-byte secret, key = first 32
 *   bytes - security/kdf.ts). Streamed: the archive is written record by record (one 1 MiB chunk in
 *   memory) and the data directory is read one file at a time - at most one diary (whose size the
 *   quota bounds) is in memory, never the archive. Only file-system calls the Android core's
 *   node:fs facade also has are used (mobile/test/vfs/server-usage.test.ts scans all of server/src),
 *   although only the hosted composition ever imports this module.
 *
 * File format (all integers little-endian unless noted):
 *
 *   offset  size  field
 *   0       8     magic "MPDARCH\x01"
 *   8       1     format version = 1
 *   9       4     scrypt N
 *   13      4     scrypt r
 *   17      4     scrypt p
 *   21      16    salt
 *   37      7     nonce prefix (random per archive)
 *   44      4     chunk size C (plaintext bytes per chunk)
 *   48      ...   records: AES-256-GCM(chunk) || tag(16)
 *
 *   Every record but the last holds exactly C plaintext bytes; the last holds 0..C. Nonce of record
 *   i = prefix(7) || i (u32 big-endian) || final flag (1 byte: 1 on the last record, else 0); the AAD
 *   of every record is the 48 header bytes. A reader therefore detects a changed header, reordered,
 *   dropped or appended records and a truncated file (the record it then takes for the last one was
 *   sealed with flag 0). scripts/hosted/restore-archive.mjs is the reader: it verifies every
 *   record before it extracts anything.
 *
 * The archive is NEVER served by the API: the owner downloads it with `flyctl ssh sftp get` from his
 * own PowerShell (`downloadCommand`). At most `keep` (2) archives stay on the volume, each with a
 * `<name>.sha256` file next to it (`<hex>  <name>`) so that the Server card can show the checksum
 * again without reading the archive.
 */
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ServerArchiveInfo, ServerArchiveResult } from '@shared/types';
import { ApiError } from '../errors';
import { DEFAULT_KDF, deriveSecret, splitSecret, wipe, type KdfParams } from '../security/kdf';
import { archiveFailed, archiveNoSpace, archiveTooSoon } from './archive-errors';
import type { ArchiveController } from './types';

export const ARCHIVE_DIR_NAME = 'archive';
export const ARCHIVE_PREFIX = 'your-personal-diary-server-';
export const ARCHIVE_EXTENSION = '.mpda';
/** `your-personal-diary-server-2026-10-27T09-30-00Z.mpda` (UTC; sorts by time). */
export const ARCHIVE_NAME_RE = /^your-personal-diary-server-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.mpda$/;
export const ARCHIVE_MAGIC = Buffer.from('MPDARCH\x01', 'latin1');
export const ARCHIVE_FORMAT_VERSION = 1;
export const ARCHIVE_HEADER_LENGTH = 48;
export const ARCHIVE_NONCE_PREFIX_LENGTH = 7;
export const ARCHIVE_TAG_LENGTH = 16;
export const ARCHIVE_SALT_LENGTH = 16;
/** Plaintext bytes per encrypted record. */
export const ARCHIVE_CHUNK_SIZE = 1024 * 1024;
/** Archives kept on the volume (the newest ones). */
export const ARCHIVE_KEEP = 2;
/** One archive per this many milliseconds (SERVER-CARD.md: 1 per 10 minutes). */
export const ARCHIVE_COOLDOWN_MS = 10 * 60_000;
/** Free space needed: this factor x the data size. */
export const ARCHIVE_SPACE_FACTOR = 1.2;
/** The owner's flyctl (docs/android-tasks/HOSTED-IMPL.md item 1) - the download runs in HIS PowerShell window. */
export const FLYCTL_WINDOWS_PATH = 'C:\\Users\\AVI\\.fly\\bin\\flyctl.exe';
/** The production Fly app (deploy/hosted/fly.toml); a machine reports its own in FLY_APP_NAME. */
export const DEFAULT_FLY_APP = 'yourpersonaldiary';

/** Top-level directories of the data dir that never go into an archive. */
const SKIP_TOP_DIRS = new Set(['archive', 'incoming', 'logs', 'log', 'tmp', 'temp', 'lost+found']);
/**
 * File names (any depth) that never go into an archive. `.admin-token` is the per-boot token of the
 * loopback admin API (hosted/admin-token.ts): useless after the next start, and no business of an archive.
 */
const SKIP_FILES = [/^device\.key(?:\..*)?$/i, /^\.admin-token(?:\..*)?$/i, /\.(?:tmp|temp|partial|swp|log)$/i, /~$/];

/** True when the entry at `rel` (POSIX path inside the data dir) belongs in an archive. */
export function isArchivedPath(rel: string, isDir: boolean): boolean {
  const parts = rel.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return false;
  if (SKIP_TOP_DIRS.has(parts[0].toLowerCase()) && (parts.length > 1 || isDir)) return false;
  if (parts.some((p) => p.toLowerCase() === 'lost+found')) return false;
  if (!isDir && SKIP_FILES.some((re) => re.test(parts[parts.length - 1]))) return false;
  return true;
}

/** Fly app names: lower-case letters, digits and hyphens. */
const FLY_APP_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** The Fly app the download command names: the machine's own `FLY_APP_NAME` when valid, else the production app. */
export function flyAppName(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.FLY_APP_NAME ?? '').trim();
  return FLY_APP_RE.test(raw) ? raw : DEFAULT_FLY_APP;
}

/** `your-personal-diary-server-<yyyy-mm-ddThh-mm-ssZ>.mpda` for the UTC time `ms`. */
export function archiveFileName(ms: number): string {
  const iso = new Date(ms).toISOString(); // 2026-10-27T09:30:00.123Z
  return `${ARCHIVE_PREFIX}${iso.slice(0, 10)}T${iso.slice(11, 13)}-${iso.slice(14, 16)}-${iso.slice(17, 19)}Z${ARCHIVE_EXTENSION}`;
}

/** ISO time of an archive name; null when the name is not one. */
export function archiveTimeOf(name: string): string | null {
  const m = ARCHIVE_NAME_RE.exec(name);
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** The PowerShell download line for the owner's own window. */
export function downloadCommand(remotePath: string, fileName: string, app: string): string {
  return `${FLYCTL_WINDOWS_PATH} ssh sftp get ${remotePath} .\\${fileName} -a ${app}`;
}

/** The PowerShell line that prints True when the downloaded file has `sha256`. */
export function hashCommand(fileName: string, sha256: string | null): string {
  return sha256 ? `(Get-FileHash .\\${fileName} -Algorithm SHA256).Hash -eq '${sha256}'` : '';
}

// tar (ustar + PAX) -------------------------------------------------------------------------------

const BLOCK = 512;
const MAX_OCTAL_11 = 0o77777777777; // 8 GiB - 1: the largest size / mtime an 11-digit field holds

function octal(value: number, digits: number): string {
  return Math.max(0, Math.floor(value)).toString(8).padStart(digits, '0');
}

function writeField(block: Buffer, offset: number, length: number, text: string): void {
  Buffer.from(text, 'utf8').copy(block, offset, 0, length);
}

/** One 512-byte ustar header. `name`/`prefix` must already fit (100 / 155 bytes). */
function ustarHeader(o: { name: string; prefix: string; mode: number; size: number; mtimeSec: number; type: string }): Buffer {
  const h = Buffer.alloc(BLOCK, 0);
  writeField(h, 0, 100, o.name);
  writeField(h, 100, 8, `${octal(o.mode, 7)}\0`);
  writeField(h, 108, 8, '0000000\0');
  writeField(h, 116, 8, '0000000\0');
  writeField(h, 124, 12, `${octal(Math.min(o.size, MAX_OCTAL_11), 11)}\0`);
  writeField(h, 136, 12, `${octal(Math.min(o.mtimeSec, MAX_OCTAL_11), 11)}\0`);
  h.fill(0x20, 148, 156); // checksum placeholder: 8 spaces
  writeField(h, 156, 1, o.type);
  writeField(h, 257, 6, 'ustar\0');
  writeField(h, 263, 2, '00');
  writeField(h, 345, 155, o.prefix);
  let sum = 0;
  for (const byte of h) sum += byte;
  writeField(h, 148, 8, `${octal(sum, 6)}\0 `);
  return h;
}

/** `"<len> key=value\n"` where <len> counts the whole record. */
function paxRecord(key: string, value: string): Buffer {
  const body = ` ${key}=${value}\n`;
  const bodyBytes = Buffer.byteLength(body, 'utf8');
  let len = bodyBytes + 1;
  while (String(len).length + bodyBytes !== len) len = String(len).length + bodyBytes;
  return Buffer.from(`${len}${body}`, 'utf8');
}

/** Splits a long path into ustar prefix + name at a '/', or null when it cannot fit. */
function splitUstar(rel: string): { prefix: string; name: string } | null {
  if (Buffer.byteLength(rel, 'utf8') <= 100) return { prefix: '', name: rel };
  for (let i = rel.indexOf('/'); i > 0; i = rel.indexOf('/', i + 1)) {
    const prefix = rel.slice(0, i);
    const name = rel.slice(i + 1);
    if (Buffer.byteLength(prefix, 'utf8') <= 155 && Buffer.byteLength(name, 'utf8') <= 100 && name) return { prefix, name };
  }
  return null;
}

function padding(size: number): Buffer {
  const rest = size % BLOCK;
  return rest === 0 ? Buffer.alloc(0) : Buffer.alloc(BLOCK - rest, 0);
}

/** The header block(s) of one entry: a PAX header first when the path or the size does not fit ustar. */
export function tarHeaderBlocks(rel: string, o: { dir: boolean; size: number; mtimeSec: number }): Buffer[] {
  const name = o.dir ? `${rel}/` : rel;
  const fits = splitUstar(name);
  const records: Buffer[] = [];
  if (!fits) records.push(paxRecord('path', name));
  if (o.size > MAX_OCTAL_11) records.push(paxRecord('size', String(o.size)));
  const blocks: Buffer[] = [];
  if (records.length) {
    const data = Buffer.concat(records);
    const base = path.posix.basename(name).slice(0, 80) || 'entry';
    blocks.push(ustarHeader({ name: `PaxHeaders/${base}`, prefix: '', mode: 0o644, size: data.length, mtimeSec: o.mtimeSec, type: 'x' }), data, padding(data.length));
  }
  const short = fits ?? { prefix: '', name: name.slice(0, 100) };
  blocks.push(ustarHeader({ name: short.name, prefix: short.prefix, mode: o.dir ? 0o700 : 0o600, size: o.dir ? 0 : o.size, mtimeSec: o.mtimeSec, type: o.dir ? '5' : '0' }));
  return blocks;
}

// Encryption --------------------------------------------------------------------------------------

/** The 48 header bytes. */
export function archiveHeader(kdf: KdfParams, salt: Buffer, noncePrefix: Buffer, chunkSize: number): Buffer {
  const h = Buffer.alloc(ARCHIVE_HEADER_LENGTH, 0);
  ARCHIVE_MAGIC.copy(h, 0);
  h[8] = ARCHIVE_FORMAT_VERSION;
  h.writeUInt32LE(kdf.N, 9);
  h.writeUInt32LE(kdf.r, 13);
  h.writeUInt32LE(kdf.p, 17);
  salt.copy(h, 21, 0, ARCHIVE_SALT_LENGTH);
  noncePrefix.copy(h, 37, 0, ARCHIVE_NONCE_PREFIX_LENGTH);
  h.writeUInt32LE(chunkSize, 44);
  return h;
}

/** Nonce of record `index`: prefix(7) || index (u32 BE) || final flag. */
export function recordNonce(prefix: Buffer, index: number, final: boolean): Buffer {
  const n = Buffer.alloc(12, 0);
  prefix.copy(n, 0, 0, ARCHIVE_NONCE_PREFIX_LENGTH);
  n.writeUInt32BE(index, 7);
  n[11] = final ? 1 : 0;
  return n;
}

/**
 * Seals a byte stream into records (see the module comment). A full chunk is sealed as "not the
 * last" only once more data arrives, so the last record may be full - or empty.
 */
class RecordSealer {
  private readonly buf: Buffer;
  private len = 0;
  private index = 0;

  constructor(
    private readonly key: Buffer,
    private readonly header: Buffer,
    private readonly prefix: Buffer,
    private readonly chunkSize: number,
    private readonly sink: (bytes: Buffer) => Promise<void>,
  ) {
    this.buf = Buffer.alloc(chunkSize);
  }

  async write(data: Buffer): Promise<void> {
    let off = 0;
    while (off < data.length) {
      if (this.len === this.chunkSize) await this.seal(false);
      const n = Math.min(this.chunkSize - this.len, data.length - off);
      data.copy(this.buf, this.len, off, off + n);
      this.len += n;
      off += n;
    }
  }

  async end(): Promise<void> {
    await this.seal(true);
    this.buf.fill(0);
  }

  private async seal(final: boolean): Promise<void> {
    if (this.index > 0xffffffff) throw new Error('archive too large');
    const cipher = createCipheriv('aes-256-gcm', this.key, recordNonce(this.prefix, this.index, final));
    cipher.setAAD(this.header);
    const body = Buffer.concat([cipher.update(this.buf.subarray(0, this.len)), cipher.final(), cipher.getAuthTag()]);
    this.len = 0;
    this.index += 1;
    await this.sink(body);
  }
}

// Collecting the data directory --------------------------------------------------------------------

interface Item {
  rel: string;
  abs: string;
  dir: boolean;
  size: number;
  mtimeSec: number;
}

function isMissing(e: unknown): boolean {
  const code = (e as NodeJS.ErrnoException)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

/** Everything an archive holds, directories before their contents, names sorted (stable archives). */
async function collect(dataDir: string): Promise<Item[]> {
  const items: Item[] = [];
  const walk = async (absDir: string, relDir: string): Promise<void> => {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(absDir, { withFileTypes: true });
    } catch (e) {
      if (isMissing(e) && relDir) return; // removed while walking
      throw e;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const abs = path.join(absDir, entry.name);
      // Never follow a link; sockets, pipes and devices have no place in an archive.
      if (!entry.isDirectory() && !entry.isFile()) continue;
      if (!isArchivedPath(rel, entry.isDirectory())) continue;
      let st: fs.Stats;
      try {
        st = fs.lstatSync(abs);
      } catch (e) {
        if (isMissing(e)) continue;
        throw e;
      }
      const mtimeSec = Math.floor(st.mtimeMs / 1000);
      if (st.isDirectory()) {
        items.push({ rel, abs, dir: true, size: 0, mtimeSec });
        await walk(abs, rel);
      } else if (st.isFile()) {
        items.push({ rel, abs, dir: false, size: st.size, mtimeSec });
      }
    }
  };
  await walk(dataDir, '');
  return items;
}

// The controller ---------------------------------------------------------------------------------

export interface ArchiveOptions {
  dataDir: string;
  /** Fly app named in the download command (default `flyAppName()`). */
  flyApp?: string;
  /** KDF parameters of new archives (default: the app's DEFAULT_KDF). */
  kdf?: KdfParams;
  chunkSize?: number;
  keep?: number;
  cooldownMs?: number;
  now?: () => number;
  /** Free bytes of the volume holding `dir` (default: fs.statfsSync); null when unknown. */
  freeBytes?: (dir: string) => number | null;
  log?: (line: string) => void;
}

function statfsFree(dir: string): number | null {
  try {
    const s = fs.statfsSync(dir);
    const free = Number(s.bavail) * Number(s.bsize);
    return Number.isFinite(free) && free >= 0 ? free : null;
  } catch {
    return null;
  }
}

/** Bytes handed to the sealer at a time. */
const READ_SLICE = 256 * 1024;

export function createArchiveController(opts: ArchiveOptions): ArchiveController {
  const dataDir = path.resolve(opts.dataDir);
  const archiveDir = path.join(dataDir, ARCHIVE_DIR_NAME);
  const app = opts.flyApp ?? flyAppName();
  const kdf = opts.kdf ?? DEFAULT_KDF;
  const chunkSize = opts.chunkSize ?? ARCHIVE_CHUNK_SIZE;
  const keep = Math.max(1, opts.keep ?? ARCHIVE_KEEP);
  const cooldownMs = opts.cooldownMs ?? ARCHIVE_COOLDOWN_MS;
  const now = opts.now ?? Date.now;
  const freeBytes = opts.freeBytes ?? statfsFree;
  const log = opts.log ?? ((line: string) => console.error(`[diary-server] ${line}`));
  if (!Number.isInteger(chunkSize) || chunkSize < 1024 || chunkSize > 16 * 1024 * 1024) throw new Error('archive chunk size out of range');

  let running = false;
  let lastStartAt: number | null = null;

  const remaining = (): number => (lastStartAt === null ? 0 : Math.max(0, lastStartAt + cooldownMs - now()));

  const infoOf = (fileName: string, sizeBytes: number, sha256: string | null): ServerArchiveInfo => {
    const full = path.join(archiveDir, fileName);
    return {
      fileName,
      path: full,
      sizeBytes,
      sha256,
      createdAt: archiveTimeOf(fileName) ?? new Date(0).toISOString(),
      downloadCommand: downloadCommand(full, fileName, app),
      hashCommand: hashCommand(fileName, sha256),
    };
  };

  const archiveNames = (): string[] => {
    try {
      return fs
        .readdirSync(archiveDir)
        .filter((n) => ARCHIVE_NAME_RE.test(n))
        .sort()
        .reverse();
    } catch {
      return [];
    }
  };

  const readSha = (fileName: string): string | null => {
    try {
      const text = fs.readFileSync(path.join(archiveDir, `${fileName}.sha256`), 'utf8');
      const m = /^([0-9a-f]{64})\b/i.exec(text.trim());
      return m ? m[1].toLowerCase() : null;
    } catch {
      return null;
    }
  };

  const list = (): ServerArchiveInfo[] => {
    const out: ServerArchiveInfo[] = [];
    for (const name of archiveNames()) {
      try {
        const st = fs.statSync(path.join(archiveDir, name));
        if (st.isFile()) out.push(infoOf(name, st.size, readSha(name)));
      } catch {
        /* removed meanwhile */
      }
    }
    return out;
  };

  const removeQuietly = (file: string) => {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      /* best effort */
    }
  };

  /** Leftovers of an interrupted run (ours only: dot-prefixed `.partial` / `.sha256.tmp` files). */
  const removeLeftovers = () => {
    let names: string[] = [];
    try {
      names = fs.readdirSync(archiveDir);
    } catch {
      return;
    }
    for (const n of names) {
      if (n.startsWith('.') && (n.endsWith('.partial') || n.endsWith('.tmp'))) removeQuietly(path.join(archiveDir, n));
    }
  };

  const prune = (): string[] => {
    const removed: string[] = [];
    for (const name of archiveNames().slice(keep)) {
      removeQuietly(path.join(archiveDir, name));
      removeQuietly(path.join(archiveDir, `${name}.sha256`));
      removed.push(name);
    }
    return removed;
  };

  const dataBytes = async (): Promise<number | null> => {
    try {
      return (await collect(dataDir)).reduce((sum, i) => sum + i.size, 0);
    } catch {
      return null;
    }
  };

  /** The archive key: scrypt(passphrase, salt) like a diary key (first 32 of 64 bytes). */
  async function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
    const secret = await deriveSecret(passphrase, salt, kdf);
    const { key, verifierSource } = splitSecret(secret);
    wipe(secret);
    wipe(verifierSource);
    return key;
  }

  /** Writes the archive under `key` (wiped before it returns). */
  async function write(items: Item[], key: Buffer, salt: Buffer, fileName: string): Promise<ServerArchiveResult> {
    const prefix = randomBytes(ARCHIVE_NONCE_PREFIX_LENGTH);
    const header = archiveHeader(kdf, salt, prefix, chunkSize);
    const partial = path.join(archiveDir, `.${fileName}.partial`);
    const finalPath = path.join(archiveDir, fileName);
    const hash = createHash('sha256');
    let size = 0;
    let files = 0;
    let plainBytes = 0;
    let fh: fs.promises.FileHandle | null = null;
    try {
      fh = await fs.promises.open(partial, 'wx', 0o600);
      const out = fh;
      const sink = async (bytes: Buffer) => {
        hash.update(bytes);
        size += bytes.length;
        let off = 0;
        while (off < bytes.length) {
          const { bytesWritten } = await out.write(bytes, off, bytes.length - off);
          off += bytesWritten;
        }
      };
      await sink(header);
      const sealer = new RecordSealer(key, header, prefix, chunkSize, sink);
      for (const item of items) {
        if (item.dir) {
          for (const b of tarHeaderBlocks(item.rel, { dir: true, size: 0, mtimeSec: item.mtimeSec })) await sealer.write(b);
          continue;
        }
        let src: fs.promises.FileHandle;
        try {
          src = await fs.promises.open(item.abs, 'r');
        } catch (e) {
          if (isMissing(e)) continue; // deleted since the walk (an account removed meanwhile)
          throw e;
        }
        try {
          // One file at a time, through the handle: an atomic replace (tmp + rename) meanwhile leaves
          // this handle on the old, complete file. The largest file is one diary (the quota keeps it
          // small); the archive itself is never held in memory.
          const st = await src.stat();
          const data = await src.readFile();
          for (const b of tarHeaderBlocks(item.rel, { dir: false, size: data.length, mtimeSec: Math.floor(st.mtimeMs / 1000) })) await sealer.write(b);
          for (let pos = 0; pos < data.length; pos += READ_SLICE) await sealer.write(data.subarray(pos, pos + READ_SLICE));
          await sealer.write(padding(data.length));
          files += 1;
          plainBytes += data.length;
        } finally {
          await src.close();
        }
      }
      await sealer.write(Buffer.alloc(BLOCK * 2, 0)); // end of the tar
      await sealer.end();
      await fh.sync();
      await fh.close();
      fh = null;
      fs.renameSync(partial, finalPath);
    } catch (e) {
      if (fh) await fh.close().catch(() => {});
      removeQuietly(partial);
      throw e;
    } finally {
      wipe(key);
    }
    const sha256 = hash.digest('hex');
    // The checksum next to the archive (sha256sum format), written atomically.
    const shaTmp = path.join(archiveDir, `.${fileName}.sha256.tmp`);
    try {
      fs.writeFileSync(shaTmp, `${sha256}  ${fileName}\n`, { mode: 0o600 });
      fs.renameSync(shaTmp, path.join(archiveDir, `${fileName}.sha256`));
    } catch {
      removeQuietly(shaTmp); // the archive itself is fine; the card shows the checksum of this answer
    }
    const removed = prune();
    return { ...infoOf(fileName, size, sha256), files, dataBytes: plainBytes, removed };
  }

  return {
    list,
    dataBytes,
    cooldownRemainingMs: remaining,
    busy: () => running,
    async create(passphrase: string): Promise<ServerArchiveResult> {
      // Check and claim in one synchronous step: two requests can never both start.
      const wait = remaining();
      if (running || wait > 0) throw archiveTooSoon(running ? cooldownMs : wait);
      running = true;
      let need = 0;
      try {
        fs.mkdirSync(archiveDir, { recursive: true, mode: 0o700 });
        removeLeftovers();
        const items = await collect(dataDir);
        const total = items.reduce((sum, i) => sum + i.size, 0);
        need = Math.ceil(total * ARCHIVE_SPACE_FACTOR);
        const free = freeBytes(archiveDir);
        if (free !== null && free < need) throw archiveNoSpace(need, free);
        // The key first: a busy scrypt gate (503) refuses before the attempt is counted.
        const salt = randomBytes(ARCHIVE_SALT_LENGTH);
        const key = await deriveKey(passphrase, salt);
        // From here on the attempt counts against the 1-per-10-minutes limit, whatever its outcome.
        const startedAt = now();
        lastStartAt = startedAt;
        let fileName = archiveFileName(startedAt);
        if (fs.existsSync(path.join(archiveDir, fileName))) fileName = archiveFileName(startedAt + 1000);
        const result = await write(items, key, salt, fileName);
        log(`Server archive written: ${result.fileName} (${result.sizeBytes} bytes, ${result.files} files; ${result.removed.length} older removed).`);
        return result;
      } catch (e) {
        if (e instanceof ApiError) throw e;
        const code = (e as NodeJS.ErrnoException)?.code;
        if (code === 'ENOSPC' || code === 'EDQUOT') {
          log('Server archive failed: the volume is full.');
          throw archiveNoSpace(need, freeBytes(archiveDir));
        }
        log(`Server archive failed (${code ?? 'error'}).`);
        throw archiveFailed();
      } finally {
        running = false;
      }
    },
  };
}
