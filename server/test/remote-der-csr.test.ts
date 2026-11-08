/**
 * DER encoder and PKCS#10 CSR builder (server/src/remote/der.ts, csr.ts): known encodings, and a
 * CSR parsed back with the test DER parser whose signature verifies over the
 * CertificationRequestInfo bytes with node:crypto.
 */
import { createPublicKey, generateKeyPairSync, verify, X509Certificate } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildCsr, isDnsName, OID } from '../src/remote/csr';
import {
  base64url,
  derBitString,
  derInteger,
  derLength,
  derOid,
  derSet,
  derTime,
  fromBase64url,
  pemBlocks,
  splitPem,
  toPem,
} from '../src/remote/der';
import { generateEcKey } from '../src/remote/tls-store';
import { makeLeaf, makeTestCa, oidString, parseCsr, parseDer } from './remote-fixtures';

const hex = (b: Buffer) => b.toString('hex');

describe('DER primitives', () => {
  it('encodes lengths in short and long form', () => {
    expect(hex(derLength(0))).toBe('00');
    expect(hex(derLength(127))).toBe('7f');
    expect(hex(derLength(128))).toBe('8180');
    expect(hex(derLength(255))).toBe('81ff');
    expect(hex(derLength(256))).toBe('820100');
    expect(hex(derLength(70000))).toBe('83011170');
  });

  it('encodes positive integers minimally, with a leading zero when the high bit is set', () => {
    expect(hex(derInteger(0))).toBe('020100');
    expect(hex(derInteger(2))).toBe('020102');
    expect(hex(derInteger(127))).toBe('02017f');
    expect(hex(derInteger(128))).toBe('02020080');
    expect(hex(derInteger(256))).toBe('02020100');
    expect(hex(derInteger(Buffer.from([0x00, 0x00, 0x05])))).toBe('020105');
    expect(hex(derInteger(Buffer.from([0xff, 0x01])))).toBe('020300ff01');
    expect(() => derInteger(-1)).toThrow();
  });

  it('encodes object identifiers (base-128 arcs) and reads them back', () => {
    expect(hex(derOid('1.2.840.10045.4.3.2'))).toBe('06082a8648ce3d040302');
    expect(hex(derOid('2.5.4.3'))).toBe('0603550403');
    expect(hex(derOid('2.5.29.17'))).toBe('0603551d11');
    expect(hex(derOid('1.2.840.113549.1.9.14'))).toBe('06092a864886f70d01090e');
    for (const oid of Object.values(OID)) expect(oidString(parseDer(derOid(oid)).content)).toBe(oid);
  });

  it('sorts SET OF members, prefixes BIT STRINGs, picks the validity time type by year', () => {
    expect(hex(derSet(Buffer.from('0201 02'.replace(' ', ''), 'hex'), Buffer.from('020101', 'hex')))).toBe('3106020101020102');
    expect(hex(derBitString(Buffer.from([0xab])))).toBe('030200ab');
    expect(derTime(new Date('2026-09-28T10:20:30Z')).toString('latin1')).toBe('\x17\x0d260928102030Z');
    expect(derTime(new Date('2051-01-02T03:04:05Z')).toString('latin1')).toBe('\x18\x0f20510102030405Z');
  });

  it('base64url without padding and PEM round trips', () => {
    expect(base64url(Buffer.from([0xfb, 0xff]))).toBe('-_8');
    expect(fromBase64url('-_8')).toEqual(Buffer.from([0xfb, 0xff]));
    const der = Buffer.alloc(100, 7);
    const pem = toPem('TEST', der);
    expect(pem.split('\n')[1]).toHaveLength(64);
    expect(pemBlocks(pem, 'TEST')[0]).toEqual(der);
    expect(splitPem(pem + pem, 'TEST')).toHaveLength(2);
  });
});

describe('buildCsr', () => {
  const hostname = 'yourpersonaldiary.duckdns.org';

  it('produces a PKCS#10 request: version 0, CN and SAN = hostname, the key SPKI, ecdsa-with-SHA256', () => {
    const key = generateEcKey();
    const csr = buildCsr(hostname, key);
    const parsed = parseCsr(csr.der);
    expect(parsed.version).toBe(0);
    expect(parsed.commonName).toBe(hostname);
    expect(parsed.sanDnsNames).toEqual([hostname]);
    expect(parsed.signatureAlgorithm).toBe(OID.ecdsaWithSha256);
    expect(parsed.spki).toEqual(createPublicKey(key).export({ type: 'spki', format: 'der' }));
    expect(parsed.info).toEqual(csr.info);
    expect(parsed.signature).toEqual(csr.signature);
  });

  it('the signature verifies over the CertificationRequestInfo bytes (and not over anything else)', () => {
    const key = generateEcKey();
    const csr = buildCsr(hostname, key);
    const pub = createPublicKey(key);
    expect(verify('sha256', csr.info, pub, csr.signature)).toBe(true);
    const tampered = Buffer.from(csr.info);
    tampered[tampered.length - 1] ^= 0x01;
    expect(verify('sha256', tampered, pub, csr.signature)).toBe(false);
    expect(parseCsr(csr.der).signatureValid).toBe(true);
  });

  it('wraps the attributes in [0] with one extensionRequest attribute', () => {
    const csr = buildCsr(hostname, generateEcKey());
    const info = parseDer(csr.info);
    expect(info.children).toHaveLength(4);
    const attrs = info.children[3];
    expect(attrs.tag).toBe(0xa0);
    expect(attrs.children).toHaveLength(1);
    expect(oidString(attrs.children[0].children[0].content)).toBe(OID.extensionRequest);
    expect(attrs.children[0].children[1].tag).toBe(0x31);
  });

  it('refuses non-DNS names and non-P-256 keys', () => {
    expect(() => buildCsr('not a host', generateEcKey())).toThrow();
    expect(() => buildCsr('*.duckdns.org', generateEcKey())).toThrow();
    const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey;
    expect(() => buildCsr(hostname, rsa)).toThrow();
    const p384 = generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey;
    expect(() => buildCsr(hostname, p384)).toThrow();
  });

  it('isDnsName accepts DuckDNS names only in lower-case DNS syntax', () => {
    expect(isDnsName('yourpersonaldiary.duckdns.org')).toBe(true);
    expect(isDnsName('a-b.duckdns.org')).toBe(true);
    expect(isDnsName('localhost')).toBe(false);
    expect(isDnsName('-bad.duckdns.org')).toBe(false);
    expect(isDnsName('Upper.duckdns.org')).toBe(false);
  });
});

describe('test X.509 builder (fixture sanity)', () => {
  it('issues certificates node:crypto parses and verifies against the test CA', () => {
    const ca = makeTestCa();
    const caCert = new X509Certificate(ca.certPem);
    expect(caCert.ca).toBe(true);
    const leaf = makeLeaf(ca, 'diarytest.duckdns.org');
    const leafCert = new X509Certificate(splitPem(leaf.certPem)[0]);
    expect(leafCert.checkHost('diarytest.duckdns.org')).toBe('diarytest.duckdns.org');
    expect(leafCert.checkIssued(caCert)).toBe(true);
    expect(leafCert.verify(caCert.publicKey)).toBe(true);
    expect(leafCert.checkPrivateKey(leaf.key)).toBe(true);
  });
});
