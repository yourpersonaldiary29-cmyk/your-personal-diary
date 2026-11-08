#!/usr/bin/env node
/**
 * Restores an encrypted server archive (WP-H8, docs/android-tasks/SERVER-CARD.md item 3;
 * docs/HOSTED-PLAN.md 3.4) into a NEW, EMPTY directory:
 *
 *   node scripts/hosted/restore-archive.mjs <your-personal-diary-server-....mpda> <target dir>
 *
 *   1. checks the target (a non-empty directory is refused - nothing is ever overwritten);
 *   2. asks for the archive passphrase - typed, never shown, NEVER an argument (so it is not in the
 *      shell history); when stdin is not a terminal, the first line of stdin is the passphrase;
 *   3. verifies EVERY encrypted record of the archive (AES-256-GCM tags, order, completeness) and
 *      prints the archive's SHA-256 - nothing is written before the whole file checks out;
 *   4. decrypts again and extracts the tar into the target (files 0600, folders 0700; links,
 *      devices, absolute paths and ".." are refused; a device.key inside would be skipped);
 *   5. prints counts only (files, bytes, accounts) - never a name or an e-mail address.
 *
 * The format is written by server/src/hosted/archive.ts (see its header comment): a 48-byte header
 * (magic "MPDARCH\x01", version 1, scrypt N/r/p, salt, nonce prefix, chunk size) followed by
 * AES-256-GCM records; key = the first 32 bytes of scrypt(NFKC(passphrase), salt, 64).
 *
 * Plain Node.js (no dependencies), no network: this tool opens no sockets
 * (scripts/check-no-network.mjs, rule 4b). Exit codes: 0 restored, 2 usage / target refused,
 * 3 wrong passphrase or damaged archive, 4 extraction failed (the target is then incomplete).
 */
import { createDecipheriv, createHash, scrypt as scryptCb } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAGIC = Buffer.from('MPDARCH\x01', 'latin1');
const FORMAT_VERSION = 1;
const HEADER_LENGTH = 48;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const NONCE_PREFIX_LENGTH = 7;
const KEY_LENGTH = 32;
const SECRET_LENGTH = 64;
/** The app's own scrypt parameters (server/src/security/kdf.ts DEFAULT_KDF); twice that work at most. */
const MAX_KDF_COST = 2 * 32768 * 8 * 1;
const BLOCK = 512;

class ExitError extends Error {
  constructor(code, message) {
    super(message);
    this.exitCode = code;
  }
}

function usage() {
  return [
    'Restore an encrypted server archive of Your Personal Diary into a new, empty directory.',
    '',
    '  node scripts/hosted/restore-archive.mjs <archive.mpda> <target directory>',
    '',
    'The passphrase is asked for (it is never given on the command line).',
  ].join('\n');
}

// Header --------------------------------------------------------------------------------------------

function parseHeader(h) {
  if (h.length < HEADER_LENGTH || !h.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new ExitError(3, 'This is not a server archive of Your Personal Diary (.mpda).');
  }
  if (h[8] !== FORMAT_VERSION) throw new ExitError(3, `Unsupported archive version ${h[8]} - use a newer version of this tool.`);
  const N = h.readUInt32LE(9);
  const r = h.readUInt32LE(13);
  const p = h.readUInt32LE(17);
  const chunkSize = h.readUInt32LE(44);
  const sane = N >= 1024 && N <= 1 << 22 && (N & (N - 1)) === 0 && r >= 1 && r <= 32 && p >= 1 && p <= 16 && N * r * p <= MAX_KDF_COST;
  if (!sane) throw new ExitError(3, 'The archive header asks for key-derivation settings this tool does not accept (damaged file?).');
  if (chunkSize < 1024 || chunkSize > 16 * 1024 * 1024) throw new ExitError(3, 'The archive header is damaged (chunk size).');
  return {
    kdf: { N, r, p },
    salt: Buffer.from(h.subarray(21, 21 + SALT_LENGTH)),
    prefix: Buffer.from(h.subarray(37, 37 + NONCE_PREFIX_LENGTH)),
    chunkSize,
    bytes: Buffer.from(h.subarray(0, HEADER_LENGTH)),
  };
}

function deriveKey(passphrase, salt, kdf) {
  const maxmem = Math.max(128 * 1024 * 1024, 2 * 128 * kdf.N * kdf.r);
  return new Promise((resolve, reject) => {
    scryptCb(Buffer.from(passphrase.normalize('NFKC'), 'utf8'), salt, SECRET_LENGTH, { ...kdf, maxmem }, (err, secret) => {
      if (err) return reject(err);
      const key = Buffer.from(secret.subarray(0, KEY_LENGTH));
      secret.fill(0);
      resolve(key);
    });
  });
}

function recordNonce(prefix, index, final) {
  const n = Buffer.alloc(12, 0);
  prefix.copy(n, 0, 0, NONCE_PREFIX_LENGTH);
  n.writeUInt32BE(index, 7);
  n[11] = final ? 1 : 0;
  return n;
}

/**
 * Reads the records of the archive in order and hands each decrypted chunk to `onPlain`. Every
 * record but the last is exactly chunkSize + 16 bytes; the last one is what remains of the file
 * (16 .. chunkSize + 16 bytes) and was sealed with the final flag - so a truncated or extended
 * file fails authentication. `onBytes` sees the raw file bytes (for the SHA-256).
 */
function forEachRecord(fd, fileSize, header, key, onPlain, onBytes) {
  const recordSize = header.chunkSize + TAG_LENGTH;
  const buf = Buffer.alloc(recordSize);
  let pos = HEADER_LENGTH;
  let index = 0;
  if (fileSize - pos < TAG_LENGTH) throw new ExitError(3, 'The archive is damaged: it ends right after its header.');
  for (;;) {
    const remaining = fileSize - pos;
    const final = remaining <= recordSize;
    const len = final ? remaining : recordSize;
    if (len < TAG_LENGTH) throw new ExitError(3, 'The archive is damaged: its last part is too short.');
    let got = 0;
    while (got < len) {
      const n = fs.readSync(fd, buf, got, len - got, pos + got);
      if (n <= 0) throw new ExitError(3, 'The archive could not be read to its end.');
      got += n;
    }
    const record = buf.subarray(0, len);
    onBytes?.(record);
    const decipher = createDecipheriv('aes-256-gcm', key, recordNonce(header.prefix, index, final));
    decipher.setAAD(header.bytes);
    decipher.setAuthTag(record.subarray(len - TAG_LENGTH));
    let plain;
    try {
      plain = Buffer.concat([decipher.update(record.subarray(0, len - TAG_LENGTH)), decipher.final()]);
    } catch {
      if (index === 0) throw new ExitError(3, 'Wrong passphrase, or the archive is damaged.');
      throw new ExitError(3, `The archive is damaged: part ${index + 1} does not verify (changed, reordered or cut off).`);
    }
    onPlain(plain, index);
    pos += len;
    index += 1;
    if (final) break;
    if (index > 0xffffffff) throw new ExitError(3, 'The archive is damaged (too many parts).');
  }
  buf.fill(0);
  return index;
}

// tar ------------------------------------------------------------------------------------------------

function cString(block, start, length) {
  const field = block.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end < 0 ? field.length : end).toString('utf8');
}

function octalField(block, start, length) {
  const text = cString(block, start, length).trim();
  if (!text) return 0;
  if (!/^[0-7]+$/.test(text)) throw new Error('a tar header holds a number that is not octal');
  return parseInt(text, 8);
}

function parsePax(data) {
  const out = {};
  let off = 0;
  while (off < data.length) {
    const space = data.indexOf(0x20, off);
    if (space < 0) break;
    const len = parseInt(data.subarray(off, space).toString('ascii'), 10);
    if (!Number.isInteger(len) || len <= 0 || off + len > data.length) throw new Error('a PAX record is damaged');
    const rec = data.subarray(space + 1, off + len - 1).toString('utf8'); // without the trailing \n
    const eq = rec.indexOf('=');
    if (eq > 0) out[rec.slice(0, eq)] = rec.slice(eq + 1);
    off += len;
  }
  return out;
}

/** The target path of an archive member, or an error for anything that could leave the target. */
function safeTarget(root, name) {
  if (!name || name.includes('\0') || name.includes('\\')) throw new Error('an entry has an unsafe name');
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) throw new Error('an entry has an absolute path');
  const parts = name.split('/').filter((p) => p !== '' && p !== '.');
  if (parts.length === 0) return null; // "./" itself
  if (parts.some((p) => p === '..')) throw new Error('an entry points outside the target ("..")');
  const dest = path.join(root, ...parts);
  const rel = path.relative(root, dest);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('an entry points outside the target');
  return { dest, parts };
}

/** A streaming tar reader that writes regular files and folders into `root` - nothing else. */
class TarExtractor {
  constructor(root) {
    this.root = root;
    this.state = 'header';
    this.header = Buffer.alloc(BLOCK);
    this.headerLen = 0;
    this.remaining = 0;
    this.padRemaining = 0;
    this.zeroBlocks = 0;
    this.pax = null;
    this.paxChunks = null;
    this.entry = null;
    this.files = 0;
    this.dirs = 0;
    this.bytes = 0;
    this.skipped = [];
  }

  push(chunk) {
    let off = 0;
    while (off < chunk.length) {
      if (this.state === 'header') {
        const n = Math.min(BLOCK - this.headerLen, chunk.length - off);
        chunk.copy(this.header, this.headerLen, off, off + n);
        this.headerLen += n;
        off += n;
        if (this.headerLen === BLOCK) {
          this.headerLen = 0;
          this.onHeader();
        }
      } else if (this.state === 'data') {
        const n = Math.min(this.remaining, chunk.length - off);
        this.onData(chunk.subarray(off, off + n));
        this.remaining -= n;
        off += n;
        if (this.remaining === 0) this.endEntry();
      } else if (this.state === 'pad') {
        const n = Math.min(this.padRemaining, chunk.length - off);
        this.padRemaining -= n;
        off += n;
        if (this.padRemaining === 0) this.state = 'header';
      } else {
        // After the two zero blocks: only zeros may follow.
        for (let i = off; i < chunk.length; i++) if (chunk[i] !== 0) throw new Error('data follows the end of the tar');
        off = chunk.length;
      }
    }
  }

  onHeader() {
    const h = this.header;
    if (h.every((b) => b === 0)) {
      this.zeroBlocks += 1;
      if (this.zeroBlocks >= 2) this.state = 'end';
      return;
    }
    if (this.zeroBlocks > 0) throw new Error('the tar is damaged (an empty block inside)');
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i];
    if (sum !== octalField(h, 148, 8)) throw new Error('a tar header does not match its checksum');
    const type = String.fromCharCode(h[156] || 0x30);
    const magic = cString(h, 257, 6);
    let name = cString(h, 0, 100);
    const prefix = magic === 'ustar' ? cString(h, 345, 155) : '';
    if (prefix) name = `${prefix}/${name}`;
    let size = octalField(h, 124, 12);
    const mtime = octalField(h, 136, 12);
    if (this.pax) {
      if (this.pax.path) name = this.pax.path;
      if (this.pax.size) size = Number(this.pax.size);
      this.pax = null;
    }
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('a tar entry has an impossible size');

    if (type === 'x' || type === 'g') {
      if (size > 1024 * 1024) throw new Error('a PAX header is too large');
      this.entry = { kind: type === 'x' ? 'pax' : 'gpax', size };
      this.paxChunks = [];
      return this.beginData(size);
    }
    if (type === '5') {
      const target = safeTarget(this.root, name);
      if (target) {
        fs.mkdirSync(target.dest, { recursive: true, mode: 0o700 });
        this.dirs += 1;
      }
      this.entry = { kind: 'skip', size };
      return this.beginData(size);
    }
    if (type === '0' || type === '7') {
      const target = safeTarget(this.root, name);
      if (!target) throw new Error('a file entry has no name');
      const base = target.parts[target.parts.length - 1];
      if (/^device\.key(?:\..*)?$/i.test(base)) {
        // The server never archives the device key; an archive that holds one keeps it out of the restore too.
        this.skipped.push('device.key');
        this.entry = { kind: 'skip', size };
        return this.beginData(size);
      }
      fs.mkdirSync(path.dirname(target.dest), { recursive: true, mode: 0o700 });
      const fd = fs.openSync(target.dest, 'wx', 0o600);
      this.entry = { kind: 'file', size, fd, dest: target.dest, mtime };
      return this.beginData(size);
    }
    throw new Error(`the archive holds an entry of a type this tool does not restore (${JSON.stringify(type)})`);
  }

  beginData(size) {
    this.remaining = size;
    this.padRemaining = size % BLOCK === 0 ? 0 : BLOCK - (size % BLOCK);
    if (size === 0) this.endEntry();
    else this.state = 'data';
  }

  onData(bytes) {
    const e = this.entry;
    if (e.kind === 'file') {
      let off = 0;
      while (off < bytes.length) off += fs.writeSync(e.fd, bytes, off, bytes.length - off);
      this.bytes += bytes.length;
    } else if (e.kind === 'pax' || e.kind === 'gpax') {
      this.paxChunks.push(Buffer.from(bytes));
    }
  }

  endEntry() {
    const e = this.entry;
    if (e?.kind === 'file') {
      fs.fsyncSync(e.fd);
      fs.closeSync(e.fd);
      if (e.mtime > 0) {
        try {
          fs.utimesSync(e.dest, e.mtime, e.mtime);
        } catch {
          /* the time is cosmetic */
        }
      }
      this.files += 1;
    } else if (e?.kind === 'pax') {
      this.pax = parsePax(Buffer.concat(this.paxChunks));
    }
    this.paxChunks = null;
    this.entry = null;
    this.state = this.padRemaining > 0 ? 'pad' : 'header';
  }

  finish() {
    if (this.entry?.kind === 'file') {
      try {
        fs.closeSync(this.entry.fd);
      } catch {
        /* already closed */
      }
    }
    if (this.state !== 'end') throw new Error('the archive ends in the middle of its contents');
  }

  abort() {
    if (this.entry?.kind === 'file') {
      try {
        fs.closeSync(this.entry.fd);
      } catch {
        /* already closed */
      }
    }
  }
}

// Passphrase -------------------------------------------------------------------------------------------

/** Asks for the passphrase without echoing it; from a pipe, the first line of stdin. */
async function readPassphrase() {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    const chunks = [];
    for await (const c of stdin) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    return Buffer.concat(chunks).toString('utf8').split(/\r?\n/)[0];
  }
  process.stderr.write('Archive passphrase (it is not shown while you type): ');
  stdin.setEncoding('utf8');
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const done = (fn) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stderr.write('\n');
      fn();
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done(() => resolve(value));
        if (ch === '\u0003' || ch === '\u0004') return done(() => reject(new ExitError(2, 'Cancelled.')));
        if (ch === '\u007f' || ch === '\b') {
          value = [...value].slice(0, -1).join('');
          continue;
        }
        if (ch === '\u0015') {
          value = '';
          continue;
        }
        if (ch < ' ') continue;
        value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

// Main -------------------------------------------------------------------------------------------------

function formatBytes(n) {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function checkTarget(target) {
  let st;
  try {
    st = fs.statSync(target);
  } catch {
    return false; // does not exist yet: created after the archive verified
  }
  if (!st.isDirectory()) throw new ExitError(2, `The target exists and is not a directory: ${target}`);
  if (fs.readdirSync(target).length > 0) {
    throw new ExitError(2, `The target directory is not empty: ${target}\nChoose a new or empty directory - this tool never overwrites anything.`);
  }
  return true;
}

async function main(argv) {
  const args = argv.filter((a) => a !== '--');
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return 0;
  }
  if (args.length > 2) {
    throw new ExitError(2, `Too many arguments. The passphrase is never given on the command line - the tool asks for it.\n\n${usage()}`);
  }
  if (args.length < 2) throw new ExitError(2, usage());
  const archive = path.resolve(args[0]);
  const target = path.resolve(args[1]);

  let fd;
  try {
    fd = fs.openSync(archive, 'r');
  } catch {
    throw new ExitError(2, `The archive cannot be opened: ${archive}`);
  }
  try {
    const fileSize = fs.fstatSync(fd).size;
    const headBuf = Buffer.alloc(HEADER_LENGTH);
    const got = fileSize >= HEADER_LENGTH ? fs.readSync(fd, headBuf, 0, HEADER_LENGTH, 0) : 0;
    const header = parseHeader(headBuf.subarray(0, got));
    checkTarget(target);

    const passphrase = await readPassphrase();
    if (!passphrase) throw new ExitError(2, 'No passphrase was entered.');
    const key = await deriveKey(passphrase, header.salt, header.kdf);
    try {
      // 1. Verify everything before writing anything.
      process.stderr.write('Verifying the archive...\n');
      const hash = createHash('sha256').update(header.bytes);
      const records = forEachRecord(
        fd,
        fileSize,
        header,
        key,
        (plain) => plain.fill(0),
        (raw) => hash.update(raw),
      );
      const sha256 = hash.digest('hex');
      console.log(`Archive verified: ${records} part(s), ${formatBytes(fileSize)}.`);
      console.log(`SHA-256: ${sha256}`);

      // 2. Extract into the (still empty) target.
      if (!checkTarget(target)) fs.mkdirSync(target, { recursive: true, mode: 0o700 });
      const tar = new TarExtractor(target);
      try {
        forEachRecord(fd, fileSize, header, key, (plain) => {
          tar.push(plain);
          plain.fill(0);
        });
        tar.finish();
      } catch (e) {
        tar.abort();
        const why = e instanceof ExitError ? e.message : `Extraction failed: ${e.message}.`;
        throw new ExitError(4, `${why}\nThe target directory is incomplete - delete it before you try again: ${target}`);
      }

      let accounts = 'unknown';
      try {
        const reg = JSON.parse(fs.readFileSync(path.join(target, 'accounts.json'), 'utf8'));
        accounts = String(Array.isArray(reg?.accounts) ? reg.accounts.length : 0);
      } catch {
        accounts = 'no accounts.json';
      }
      console.log(`Restored ${tar.files} file(s) and ${tar.dirs} folder(s), ${formatBytes(tar.bytes)}, into ${target}`);
      console.log(`Accounts in the archive: ${accounts}`);
      if (tar.skipped.length) console.log(`Skipped: ${tar.skipped.join(', ')} (the device key is never restored from an archive).`);
      console.log('Next (restore drill, docs/HOSTED-RUNBOOK.he.md): start the server in hosted mode on 127.0.0.1 with');
      console.log('DIARY_DATA_DIR set to this folder and DIARY_DEVICE_KEY typed into this window, then sign in.');
      return 0;
    } finally {
      key.fill(0);
    }
  } finally {
    fs.closeSync(fd);
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    if (e instanceof ExitError) {
      console.error(e.message);
      process.exit(e.exitCode);
    }
    console.error(`Restore failed: ${e?.message ?? e}`);
    process.exit(4);
  },
);
