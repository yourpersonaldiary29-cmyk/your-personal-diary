/**
 * Certificate storage under `<dataDir>/tls/` (owner-only file permissions, atomic writes):
 *
 *   account.key   ACME account key (EC P-256, PKCS#8 PEM) - one key, registered with every directory
 *   cert.key      private key of the current certificate (EC P-256, PKCS#8 PEM)
 *   cert.pem      the certificate chain as downloaded from the ACME server (leaf first)
 *   cert.json     { hostname, staging, directoryUrl, obtainedAt } - what the chain was issued for
 */
import { createPrivateKey, generateKeyPairSync, X509Certificate, type KeyObject } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { RemoteCertificateInfo } from '@shared/types';
import { splitPem } from './der';

export interface TlsPaths {
  dir: string;
  accountKey: string;
  certKey: string;
  certChain: string;
  certMeta: string;
}

export function tlsPaths(dataDir: string): TlsPaths {
  const dir = path.join(dataDir, 'tls');
  return {
    dir,
    accountKey: path.join(dir, 'account.key'),
    certKey: path.join(dir, 'cert.key'),
    certChain: path.join(dir, 'cert.pem'),
    certMeta: path.join(dir, 'cert.json'),
  };
}

/** Writes `data` atomically with owner-only permissions (0600; on Windows the profile ACLs apply). */
export function writePrivateFile(file: string, data: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* best effort */
  }
}

export function generateEcKey(): KeyObject {
  return generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
}

export function keyToPem(key: KeyObject): string {
  return key.export({ type: 'pkcs8', format: 'pem' }).toString();
}

/** The ACME account key, created on first use. */
export function loadOrCreateAccountKey(paths: TlsPaths): KeyObject {
  try {
    return createPrivateKey(fs.readFileSync(paths.accountKey, 'utf8'));
  } catch {
    const key = generateEcKey();
    writePrivateFile(paths.accountKey, keyToPem(key));
    return key;
  }
}

export interface CertMeta {
  hostname: string;
  staging: boolean;
  directoryUrl: string;
  obtainedAt: string;
}

export interface StoredCertificate {
  keyPem: string;
  certPem: string;
  meta: CertMeta;
  validTo: Date;
  issuer: string;
}

export function saveCertificate(paths: TlsPaths, keyPem: string, certPem: string, meta: CertMeta): void {
  // Key first: a crash between the two writes leaves a chain that does not match its key, which
  // loadCertificate rejects (the next run simply requests a new certificate).
  writePrivateFile(paths.certKey, keyPem);
  writePrivateFile(paths.certChain, certPem);
  writePrivateFile(paths.certMeta, JSON.stringify(meta, null, 2));
}

/**
 * Removes every stored key and certificate (account.key, cert.key, cert.pem, cert.json and any
 * leftover .tmp file) - used when the account that set remote access up is deleted. Returns false
 * when a file could not be removed.
 */
export function deleteTlsFiles(paths: TlsPaths): boolean {
  let ok = true;
  for (const file of [paths.certKey, paths.certChain, paths.certMeta, paths.accountKey]) {
    for (const f of [file, `${file}.tmp`]) {
      try {
        fs.rmSync(f, { force: true });
      } catch {
        ok = false;
      }
    }
  }
  return ok;
}

/** Readable issuer: "O / CN" of the leaf's issuer (e.g. "Let's Encrypt / R11"). */
export function issuerName(cert: X509Certificate): string {
  const fields = new Map<string, string>();
  for (const line of cert.issuer.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) fields.set(line.slice(0, i).trim(), line.slice(i + 1).trim());
  }
  const parts = [fields.get('O'), fields.get('CN')].filter((p): p is string => !!p);
  return parts.length ? parts.join(' / ') : cert.issuer.replace(/\r?\n/g, ', ');
}

export function leafOf(certPem: string): X509Certificate {
  const first = splitPem(certPem)[0];
  if (!first) throw new Error('no certificate in the chain');
  return new X509Certificate(first);
}

/** The stored certificate, or null when missing, unreadable, or not matching its key. */
export function loadCertificate(paths: TlsPaths): StoredCertificate | null {
  try {
    const keyPem = fs.readFileSync(paths.certKey, 'utf8');
    const certPem = fs.readFileSync(paths.certChain, 'utf8');
    const meta = JSON.parse(fs.readFileSync(paths.certMeta, 'utf8')) as CertMeta;
    const leaf = leafOf(certPem);
    if (!leaf.checkPrivateKey(createPrivateKey(keyPem))) return null;
    return { keyPem, certPem, meta, validTo: new Date(leaf.validTo), issuer: issuerName(leaf) };
  } catch {
    return null;
  }
}

const DAY_MS = 86_400_000;

export function daysLeft(validTo: Date, now: Date): number {
  return Math.max(0, Math.floor((validTo.getTime() - now.getTime()) / DAY_MS));
}

export function certificateInfo(stored: StoredCertificate, now: Date): RemoteCertificateInfo {
  return {
    validTo: stored.validTo.toISOString(),
    issuer: stored.issuer,
    daysLeft: daysLeft(stored.validTo, now),
    staging: stored.meta.staging,
  };
}

/** True when the stored chain was issued for `hostname` (by the same environment) and is valid for at least `minDays` more days. */
export function isUsable(stored: StoredCertificate | null, hostname: string, staging: boolean, now: Date, minDays: number): boolean {
  if (!stored) return false;
  if (stored.meta.hostname !== hostname || stored.meta.staging !== staging) return false;
  try {
    if (!leafOf(stored.certPem).checkHost(hostname)) return false;
  } catch {
    return false;
  }
  return stored.validTo.getTime() - now.getTime() >= minDays * DAY_MS;
}
