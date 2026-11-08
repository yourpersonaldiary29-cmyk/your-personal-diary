/**
 * Entry of the "core import probe" (core-import-probe.test.ts): a tiny stand-in for the worker
 * entry of the Android core. It is BUNDLED with the alias plugin and then run in a JavaScript
 * context that has no Node.js at all, so everything below executes on the shims.
 *
 * Like the real worker entry (WP-5) it imports the globals shim first; the server modules
 * themselves are imported unchanged from server/src.
 */
import '../../core/shims/globals';
import { Buffer } from '../../core/shims/buffer';
import type { DiaryDb } from '../../../server/src/db/database';
import * as schema from '../../../server/src/db/schema';
import * as csv from '../../../server/src/export/csv';
import type { ExportData } from '../../../server/src/export/data';
import * as container from '../../../server/src/security/container';
import * as kdf from '../../../server/src/security/kdf';

export interface ProbeInput {
  password: string;
  saltHex: string;
  plainHex: string;
  /** A container written by the desktop (node:crypto) for the same password. */
  desktopContainerHex: string;
  exportData: ExportData;
}

export interface ProbeResult {
  /** What the context looks like from inside the bundle. */
  environment: {
    hasRequire: boolean;
    hasNodeProcess: boolean;
    platform: string;
    bufferIsPolyfill: boolean;
  };
  secretHex: string;
  verifierHex: string;
  containerHex: string;
  reopenedHex: string;
  desktopPlainHex: string;
  wrongPasswordCode: string | null;
  schemaVersion: number;
  /** The statements applySchema() runs on an empty database, and their SHA-256. */
  schemaStatements: number;
  schemaSha256: string;
  newerSchemaMessage: string;
  csvHeader: string[];
  csvHex: string;
}

/** What applySchema() sends to an empty database (recorded; no SQLite in this probe). */
export function schemaStatements(): string[] {
  const statements: string[] = [];
  const recorder = {
    get: () => ({ n: 0 }),
    exec: (sql: string) => void statements.push(sql),
    run: (sql: string, params?: unknown[]) => void statements.push(`${sql} ${JSON.stringify(params ?? [])}`),
    transaction: (work: () => void) => work(),
  };
  schema.applySchema(recorder as unknown as DiaryDb);
  return statements;
}

export async function run(input: ProbeInput): Promise<ProbeResult> {
  const scope = globalThis as unknown as { require?: unknown; process?: { versions?: { node?: string }; platform?: string }; Buffer?: unknown };
  const salt = Buffer.from(input.saltHex, 'hex');

  const secret = await kdf.deriveSecret(input.password, salt);
  const { key, verifierSource } = kdf.splitSecret(secret);
  const sealed = container.encryptContainer(Buffer.from(input.plainHex, 'hex'), key, salt);
  const reopened = container.decryptContainer(sealed, key);
  const desktop = await container.decryptWithPassword(Buffer.from(input.desktopContainerHex, 'hex'), input.password);

  const statements = schemaStatements();

  let wrongPasswordCode: string | null = null;
  try {
    await container.decryptWithPassword(sealed, `${input.password}!`);
  } catch (e) {
    wrongPasswordCode = String((e as { code?: unknown }).code ?? (e as Error).name);
  }

  return {
    environment: {
      hasRequire: typeof scope.require !== 'undefined',
      hasNodeProcess: typeof scope.process?.versions?.node === 'string',
      platform: String(scope.process?.platform),
      bufferIsPolyfill: scope.Buffer === Buffer,
    },
    secretHex: secret.toString('hex'),
    verifierHex: kdf.verifierHex(verifierSource),
    containerHex: sealed.toString('hex'),
    reopenedHex: reopened.plain.toString('hex'),
    desktopPlainHex: desktop.plain.toString('hex'),
    wrongPasswordCode,
    schemaVersion: schema.SCHEMA_VERSION,
    schemaStatements: statements.length,
    schemaSha256: kdf.sha256Hex(statements.join('\n')),
    newerSchemaMessage: new schema.NewerSchemaError(schema.SCHEMA_VERSION + 1).message,
    csvHeader: csv.csvHeader(input.exportData.locale),
    csvHex: csv.exportCsv(input.exportData).toString('hex'),
  };
}
