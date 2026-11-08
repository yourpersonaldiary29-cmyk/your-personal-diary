/**
 * HTTPS listener (server/src/remote/tls.ts) with certificates issued by the test CA through the
 * fixture X.509 builder, and the certificate store (tls-store.ts).
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { HSTS_VALUE, startTlsListener, type TlsListener } from '../src/remote/tls';
import {
  certificateInfo,
  isUsable,
  loadCertificate,
  loadOrCreateAccountKey,
  saveCertificate,
  tlsPaths,
} from '../src/remote/tls-store';
import { cleanupTempDirs, tempDataDir } from './helpers';
import { httpsGet, makeLeaf, makeTestCa } from './remote-fixtures';

const HOST = 'diarytest.duckdns.org';
const ca = makeTestCa();

const listeners: TlsListener[] = [];
afterEach(async () => {
  for (const l of listeners.splice(0)) await l.close();
});
afterAll(cleanupTempDirs);


describe('startTlsListener', () => {
  it('serves the handler over TLS with HSTS, nosniff and frame-ancestors', async () => {
    const leaf = makeLeaf(ca, HOST);
    const l = await startTlsListener((_req, res) => res.end('hello'), leaf, { port: 0, host: '127.0.0.1' });
    listeners.push(l);
    const r = await httpsGet(l.port, HOST, ca.certPem);
    expect(r.status).toBe(200);
    expect(r.body).toBe('hello');
    expect(r.headers['strict-transport-security']).toBe(HSTS_VALUE);
    expect(r.headers['strict-transport-security']).toBe('max-age=31536000');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-security-policy']).toBe("frame-ancestors 'none'");
  });

  it('a client that does not trust the CA, or asks for another name, is refused', async () => {
    const leaf = makeLeaf(ca, HOST);
    const l = await startTlsListener((_req, res) => res.end('x'), leaf, { port: 0, host: '127.0.0.1' });
    listeners.push(l);
    await expect(httpsGet(l.port, HOST, makeTestCa('Stranger').certPem)).rejects.toThrow();
    await expect(httpsGet(l.port, 'other.duckdns.org', ca.certPem)).rejects.toThrow();
  });

  it('hot-reloads a renewed certificate for new connections', async () => {
    const first = makeLeaf(ca, HOST);
    const second = makeLeaf(ca, HOST);
    const l = await startTlsListener((_req, res) => res.end('x'), first, { port: 0, host: '127.0.0.1' });
    listeners.push(l);
    const before = await httpsGet(l.port, HOST, ca.certPem);
    l.reload(second);
    const after = await httpsGet(l.port, HOST, ca.certPem);
    expect(after.status).toBe(200);
    expect(after.serial).not.toBe(before.serial);
  });

  it('falls back to another port when the wanted one is busy', async () => {
    const blocker = net.createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', () => resolve()));
    const busy = (blocker.address() as net.AddressInfo).port;
    try {
      const leaf = makeLeaf(ca, HOST);
      const l = await startTlsListener((_req, res) => res.end('fallback'), leaf, { port: busy, host: '127.0.0.1', fallbackPort: 0 });
      listeners.push(l);
      expect(l.requestedPort).toBe(busy);
      expect(l.port).not.toBe(busy);
      expect((await httpsGet(l.port, HOST, ca.certPem)).body).toBe('fallback');
      await expect(startTlsListener((_req, res) => res.end(), leaf, { port: busy, host: '127.0.0.1', fallbackPort: null })).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });
});

describe('certificate store (tls/)', () => {
  it('creates the account key once, saves and reloads the chain, reports validity', () => {
    const dir = tempDataDir();
    const paths = tlsPaths(dir);
    const k1 = loadOrCreateAccountKey(paths);
    const k2 = loadOrCreateAccountKey(paths);
    expect(k1.export({ format: 'jwk' })).toEqual(k2.export({ format: 'jwk' }));
    expect(loadCertificate(paths)).toBeNull();

    const notAfter = new Date(Date.now() + 40 * 86_400_000);
    const leaf = makeLeaf(ca, HOST, notAfter);
    saveCertificate(paths, leaf.keyPem, leaf.certPem, { hostname: HOST, staging: false, directoryUrl: 'http://mock/directory', obtainedAt: new Date().toISOString() });
    expect(fs.readdirSync(path.join(dir, 'tls')).sort()).toEqual(['account.key', 'cert.json', 'cert.key', 'cert.pem']);
    const stored = loadCertificate(paths)!;
    expect(stored).not.toBeNull();
    const info = certificateInfo(stored, new Date());
    expect(info.daysLeft).toBeGreaterThanOrEqual(39);
    expect(info.daysLeft).toBeLessThanOrEqual(40);
    expect(info.issuer).toBe('Mock ACME / Test ACME Root');
    expect(info.staging).toBe(false);

    const now = new Date();
    expect(isUsable(stored, HOST, false, now, 30)).toBe(true);
    expect(isUsable(stored, HOST, false, now, 45)).toBe(false); // renewal due below 45 days
    expect(isUsable(stored, 'other.duckdns.org', false, now, 30)).toBe(false);
    expect(isUsable(stored, HOST, true, now, 30)).toBe(false); // staging cert wanted
  });

  it('rejects a chain that does not match its key', () => {
    const dir = tempDataDir();
    const paths = tlsPaths(dir);
    const a = makeLeaf(ca, HOST);
    const b = makeLeaf(ca, HOST);
    saveCertificate(paths, a.keyPem, b.certPem, { hostname: HOST, staging: false, directoryUrl: 'x', obtainedAt: '' });
    expect(loadCertificate(paths)).toBeNull();
  });
});
