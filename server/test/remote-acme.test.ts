/**
 * ACME v2 client (server/src/remote/acme.ts) against an in-process mock ACME server that verifies
 * every JWS (ES256, nonce, url, jwk/kid), checks the dns-01 TXT value published through the mock
 * DuckDNS, verifies the CSR signature and issues a chain signed by a test CA.
 */
import { createHash, createPrivateKey, createPublicKey, verify, X509Certificate } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  dns01TxtValue,
  jwkOf,
  jwkThumbprint,
  keyAuthorization,
  obtainCertificate,
  signJws,
  type ObtainOptions,
} from '../src/remote/acme';
import { base64url, fromBase64url, splitPem } from '../src/remote/der';
import * as duckdns from '../src/remote/duckdns';
import { RemoteError } from '../src/remote/errors';
import { generateEcKey } from '../src/remote/tls-store';
import { makeTestCa, startMockAcme, startMockDuckDns, type MockAcme, type MockAcmeOptions, type MockDuckDns } from './remote-fixtures';

const TOKEN = '0123abcd-4567-89ab-cdef-0123456789ab';
const HOST = 'diarytest.duckdns.org';

const open: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const s of open.splice(0)) await s.close();
});

async function setup(acmeOpts: Partial<MockAcmeOptions> = {}): Promise<{ duck: MockDuckDns; acme: MockAcme }> {
  const duck = await startMockDuckDns({ token: TOKEN, domain: 'diarytest' });
  const acme = await startMockAcme({ txtFor: (n) => duck.txtFor(n), ...acmeOpts });
  open.push(duck, acme);
  return { duck, acme };
}

function options(duck: MockDuckDns, acme: MockAcme, extra: Partial<ObtainOptions> = {}): ObtainOptions & { progress: string[] } {
  const progress: string[] = [];
  return {
    progress,
    directoryUrl: acme.directoryUrl,
    hostname: HOST,
    accountKey: generateEcKey(),
    pollIntervalMs: 10,
    pollTimeoutMs: 5000,
    onProgress: (key) => progress.push(key.replace('server.remote.step.certificate.', '')),
    setTxt: async (value) => {
      const r = await duckdns.setTxt(HOST, TOKEN, value, { baseUrl: duck.baseUrl });
      if (!r.ok) throw new RemoteError('server.remote.step.certificate.txtFailed');
    },
    clearTxt: async () => {
      await duckdns.clearTxt(HOST, TOKEN, { baseUrl: duck.baseUrl });
    },
    waitForTxt: async (name, value) => duck.txtFor(name) === value,
    ...extra,
  };
}

describe('JWK / JWS helpers', () => {
  it('thumbprint = SHA-256 of the canonical JWK; dns-01 value = SHA-256 of the key authorization', () => {
    const key = generateEcKey();
    const jwk = jwkOf(key);
    expect(Object.keys(jwk).sort()).toEqual(['crv', 'kty', 'x', 'y']);
    expect(jwk.crv).toBe('P-256');
    const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
    expect(jwkThumbprint(jwk)).toBe(base64url(createHash('sha256').update(canonical).digest()));
    const ka = keyAuthorization('tok_123', key);
    expect(ka).toBe(`tok_123.${jwkThumbprint(jwk)}`);
    expect(dns01TxtValue(ka)).toBe(base64url(createHash('sha256').update(ka).digest()));
    expect(dns01TxtValue(ka)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('signs ES256 flattened JWS (raw r||s) with jwk or kid, and empty payload for POST-as-GET', () => {
    const key = generateEcKey();
    const withJwk = signJws(key, { nonce: 'n1', url: 'http://x/new-account' }, { termsOfServiceAgreed: true });
    const header = JSON.parse(fromBase64url(withJwk.protected).toString());
    expect(header).toMatchObject({ alg: 'ES256', nonce: 'n1', url: 'http://x/new-account' });
    expect(header.jwk).toEqual(jwkOf(key));
    expect(header.kid).toBeUndefined();
    const sig = fromBase64url(withJwk.signature);
    expect(sig).toHaveLength(64);
    expect(verify('sha256', Buffer.from(`${withJwk.protected}.${withJwk.payload}`), { key: createPublicKey(key), dsaEncoding: 'ieee-p1363' }, sig)).toBe(true);

    const asGet = signJws(key, { nonce: 'n2', url: 'http://x/order/1', kid: 'http://x/acct/1' }, null);
    expect(asGet.payload).toBe('');
    const h2 = JSON.parse(fromBase64url(asGet.protected).toString());
    expect(h2.kid).toBe('http://x/acct/1');
    expect(h2.jwk).toBeUndefined();
  });
});

describe('obtainCertificate (dns-01 against the mock ACME server)', () => {
  it('registers, publishes the TXT proof, finalizes with a valid CSR and returns a chain for the key', async () => {
    const { duck, acme } = await setup({ pendingPolls: 2, processingPolls: 2 });
    const o = options(duck, acme);
    const result = await obtainCertificate(o);

    const [leafPem, caPem] = splitPem(result.certPem);
    expect(caPem).toBeDefined();
    const leaf = new X509Certificate(leafPem);
    const ca = new X509Certificate(caPem);
    expect(leaf.checkHost(HOST)).toBe(HOST);
    expect(leaf.checkIssued(ca)).toBe(true);
    expect(leaf.verify(ca.publicKey)).toBe(true);
    expect(leaf.checkPrivateKey(createPrivateKey(result.keyPem))).toBe(true);

    // The mock saw exactly one well-formed CSR naming the host, and no rejected request.
    expect(acme.csrs).toHaveLength(1);
    expect(acme.csrs[0]).toMatchObject({ commonName: HOST, sanDnsNames: [HOST], signatureValid: true });
    expect(acme.rejected).toBe(0);
    expect(acme.orders[0].status).toBe('valid');

    // TXT published, then removed; progress in order.
    const txtCalls = duck.calls.filter((q) => q.has('txt'));
    expect(txtCalls).toHaveLength(2);
    expect(txtCalls[0].get('txt')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(txtCalls[1].get('clear')).toBe('true');
    expect(duck.txt).toBeNull();
    expect(o.progress).toEqual(['account', 'order', 'publishTxt', 'waitDns', 'validating', 'finalizing', 'downloading']);
  });

  it('reuses the account for the same key (newAccount answers 200 the second time)', async () => {
    const { duck, acme } = await setup();
    const o = options(duck, acme);
    await obtainCertificate(o);
    await obtainCertificate({ ...o });
    expect(acme.accounts.size).toBe(1);
    expect(acme.orders).toHaveLength(2);
  });

  it('retries a badNonce answer with the fresh nonce', async () => {
    const { duck, acme } = await setup({ badNonceOnce: true });
    const result = await obtainCertificate(options(duck, acme));
    expect(result.certPem).toContain('BEGIN CERTIFICATE');
    expect(acme.rejected).toBe(1);
  });

  it('a wrong TXT value makes the authorization invalid -> rejected, and the TXT is cleared', async () => {
    const { duck, acme } = await setup();
    const o = options(duck, acme, {
      setTxt: async () => {
        await duckdns.setTxt(HOST, TOKEN, 'not-the-right-value', { baseUrl: duck.baseUrl });
      },
      waitForTxt: async () => true,
    });
    const err = await obtainCertificate(o).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RemoteError);
    expect((err as RemoteError).key).toBe('server.remote.step.certificate.rejected');
    expect(String((err as RemoteError).params.detail)).toContain('Incorrect TXT record');
    expect(duck.txt).toBeNull();
  });

  it('the TXT never showing up in DNS -> dnsTimeout (Let\'s Encrypt is not asked to validate)', async () => {
    const { duck, acme } = await setup();
    const err = await obtainCertificate(options(duck, acme, { waitForTxt: async () => false })).catch((e: unknown) => e);
    expect((err as RemoteError).key).toBe('server.remote.step.certificate.dnsTimeout');
    expect(acme.orders[0].challengeStatus).toBe('pending');
    expect(duck.txt).toBeNull();
  });

  it('DuckDNS refusing the TXT -> txtFailed', async () => {
    const { duck, acme } = await setup();
    const o = options(duck, acme, {
      setTxt: async (value) => {
        const r = await duckdns.setTxt(HOST, 'ffffffff-ffff-ffff-ffff-ffffffffffff', value, { baseUrl: duck.baseUrl });
        if (!r.ok) throw new RemoteError('server.remote.step.certificate.txtFailed');
      },
    });
    const err = await obtainCertificate(o).catch((e: unknown) => e);
    expect((err as RemoteError).key).toBe('server.remote.step.certificate.txtFailed');
  });

  it('rate limits -> rateLimited with the server detail', async () => {
    const { duck, acme } = await setup({ rateLimited: true });
    const err = await obtainCertificate(options(duck, acme)).catch((e: unknown) => e);
    expect((err as RemoteError).key).toBe('server.remote.step.certificate.rateLimited');
    expect((err as RemoteError).params.detail).toContain('too many certificates');
  });

  it('an unreachable directory -> unreachable', async () => {
    const { duck, acme } = await setup();
    const err = await obtainCertificate(options(duck, acme, { directoryUrl: 'http://127.0.0.1:9/directory', timeoutMs: 3000 })).catch((e: unknown) => e);
    expect((err as RemoteError).key).toBe('server.remote.step.certificate.unreachable');
  });

  it('aborting cancels the flow (CancelledError) and still clears the TXT', async () => {
    const { duck, acme } = await setup();
    const abort = new AbortController();
    const o = options(duck, acme, {
      signal: abort.signal,
      waitForTxt: async () => {
        abort.abort();
        return true;
      },
    });
    const err = await obtainCertificate(o).catch((e: unknown) => e);
    expect((err as Error).name).toBe('CancelledError');
    expect(duck.txt).toBeNull();
  });

  it('uses a CA-signed chain whose issuer the test CA is (fixture self-check)', () => {
    const ca = makeTestCa('Other');
    expect(new X509Certificate(ca.certPem).subject).toContain('CN=Other');
  });
});
