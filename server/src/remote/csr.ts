/**
 * PKCS#10 certificate signing request (RFC 2986) built by hand in DER, for an EC P-256 key.
 *
 *   CertificationRequest ::= SEQUENCE {
 *     certificationRequestInfo  SEQUENCE {
 *       version        INTEGER 0,
 *       subject        Name  (CN=<hostname>),
 *       subjectPKInfo  SubjectPublicKeyInfo  (the key's SPKI DER, as exported by node:crypto),
 *       attributes [0] { extensionRequest { subjectAltName { dNSName <hostname> } } } },
 *     signatureAlgorithm  SEQUENCE { ecdsa-with-SHA256 },
 *     signature           BIT STRING (DER ECDSA-Sig-Value over certificationRequestInfo) }
 */
import { createPublicKey, sign, type KeyObject } from 'node:crypto';
import {
  derBitString,
  derContext,
  derInteger,
  derOctetString,
  derOid,
  derSequence,
  derSet,
  derUtf8String,
  tlv,
} from './der';

export const OID = {
  commonName: '2.5.4.3',
  organizationName: '2.5.4.10',
  ecPublicKey: '1.2.840.10045.2.1',
  prime256v1: '1.2.840.10045.3.1.7',
  ecdsaWithSha256: '1.2.840.10045.4.3.2',
  extensionRequest: '1.2.840.113549.1.9.14',
  subjectAltName: '2.5.29.17',
  basicConstraints: '2.5.29.19',
  keyUsage: '2.5.29.15',
  extKeyUsage: '2.5.29.37',
  serverAuth: '1.3.6.1.5.5.7.3.1',
} as const;

/** Name ::= SEQUENCE OF RDN; one RDN with CN=<value>. */
export function nameCn(commonName: string): Buffer {
  return derSequence(derSet(derSequence(derOid(OID.commonName), derUtf8String(commonName))));
}

/** GeneralNames with dNSName entries ([2] IMPLICIT IA5String). */
export function generalNamesDns(hostnames: string[]): Buffer {
  return derSequence(...hostnames.map((h) => tlv(0x82, Buffer.from(h, 'ascii'))));
}

/** Extension ::= SEQUENCE { extnID, critical BOOLEAN DEFAULT FALSE (omitted), extnValue OCTET STRING }. */
export function extension(oid: string, value: Buffer): Buffer {
  return derSequence(derOid(oid), derOctetString(value));
}

export const ECDSA_SHA256_ALGORITHM = derSequence(derOid(OID.ecdsaWithSha256));

export interface Csr {
  /** Complete CertificationRequest DER. */
  der: Buffer;
  /** The signed part (certificationRequestInfo) - exposed for tests. */
  info: Buffer;
  /** DER ECDSA-Sig-Value. */
  signature: Buffer;
}

/** Lower-case DNS name check (letters, digits, hyphens, dots; no wildcards). */
export function isDnsName(hostname: string): boolean {
  return (
    hostname.length > 0 &&
    hostname.length <= 253 &&
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(hostname)
  );
}

/**
 * Builds and signs the CSR for `hostname` with `privateKey` (EC P-256). The public key is taken
 * from the private key; the subject is CN=<hostname> and the SAN carries the same name.
 */
export function buildCsr(hostname: string, privateKey: KeyObject): Csr {
  if (!isDnsName(hostname)) throw new RangeError(`not a DNS name: ${hostname}`);
  if (privateKey.asymmetricKeyType !== 'ec' || privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new RangeError('the certificate key must be EC P-256');
  }
  const spki = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const extensions = derSequence(extension(OID.subjectAltName, generalNamesDns([hostname])));
  const attribute = derSequence(derOid(OID.extensionRequest), derSet(extensions));
  const info = derSequence(derInteger(0), nameCn(hostname), spki, derContext(0, attribute));
  const signature = sign('sha256', info, { key: privateKey, dsaEncoding: 'der' });
  const der = derSequence(info, ECDSA_SHA256_ALGORITHM, derBitString(signature));
  return { der, info, signature };
}
