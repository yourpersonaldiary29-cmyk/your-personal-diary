/**
 * Access to the byte-compatibility fixtures (mobile/test/fixtures), which
 * scripts/mobile/make-fixtures.mjs generated with the real server modules under Node.js.
 * MPD_FIXTURES_DIR points the suite at another set (a fresh one written with `--out=<dir>`).
 */
import fs from 'node:fs';
import path from 'node:path';

export const FIXTURES_DIR = process.env.MPD_FIXTURES_DIR
  ? path.resolve(process.env.MPD_FIXTURES_DIR)
  : path.join(process.cwd(), 'mobile', 'test', 'fixtures');

export interface BackupFixture {
  password: string;
  fileSha256: string;
  plainSha256: string;
  plainLength: number;
}

export interface FixtureManifest {
  appVersion: string;
  files: {
    accounts: string;
    sessions: string;
    deviceKey: string;
    diary: string;
    backupAccountPassword: string;
    backupOwnPassword: string;
  };
  account: {
    id: string;
    username: string;
    password: string;
    dbFile: string;
    kdf: { algorithm: 'scrypt'; N: number; r: number; p: number; saltHex: string };
    verifierHex: string;
    recoveryWrappedKey: string;
  };
  diaryKeyHex: string;
  deviceKeyHex: string;
  session: { token: string; tokenHash: string; wrappedKeyBase64: string };
  diary: { fileSha256: string; plainSha256: string; plainLength: number };
  backups: { accountPassword: BackupFixture; ownPassword: BackupFixture };
  content: {
    entries: number;
    seededEntries: number;
    habits: number;
    habitLogs: number;
    entriesSha256: string;
    lastEntry: { title: string; body: string; notes: string; tags: string[] } | null;
  };
  mail: { password: string; passwordEnc: string };
}

export interface KdfVector {
  label: string;
  password: string;
  saltHex: string;
  secretHex: string;
}

export interface KdfVectorsFile {
  kdf: { N: number; r: number; p: number };
  secretLength: number;
  vectors: KdfVector[];
}

/** The bytes of one fixture file (a Node Buffer). */
export function fixtureBytes(relative: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES_DIR, relative));
}

function fixtureJson<T>(relative: string): T {
  return JSON.parse(fixtureBytes(relative).toString('utf8')) as T;
}

export function loadManifest(): FixtureManifest {
  return fixtureJson<FixtureManifest>('manifest.json');
}

export function loadKdfVectors(): KdfVectorsFile {
  return fixtureJson<KdfVectorsFile>('kdf-vectors.json');
}

/** sql-wasm.wasm of the browser build (what the Android host hands to the core). */
export function sqlWasmBytes(): Buffer {
  return fs.readFileSync(path.join(process.cwd(), 'server', 'node_modules', 'sql.js', 'dist', 'sql-wasm-browser.wasm'));
}
