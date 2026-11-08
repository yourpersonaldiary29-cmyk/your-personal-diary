/**
 * The REAL hosted composition for the offline e2e test (OFFLINE-DESIGN.md section 9 "Server"):
 * server/src/hosted.ts `startHosted` from source under Node (../compat/native-server.ts), on
 * 127.0.0.1 and a free port (never 47321), a temporary data directory, a test `DIARY_DEVICE_KEY`
 * (so a restart reopens remember-me vaults exactly as on the platform), a fast KDF and generous
 * login limits (the test signs in a dozen times). `DIARY_MAX_DIARY_BYTES` is small only where the
 * test asks for it (L6).
 *
 * `restart()` stops the listener and starts a new composition on the SAME data directory and port:
 * regular sessions are gone (they live in memory), remember-me sessions reopen their vault.
 *
 * `diskDiary()` decrypts the account's `.mpd` file as it is on disk right now (the password-wrapped
 * container) - what survives a crash - for the exactly-once and "by clientId" checks.
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { openNativeServer, type NativeServer } from '../compat/native-server';

type HostedModule = typeof import('../../../server/src/hosted');
type ConfigModule = typeof import('../../../server/src/config');
type ContainerModule = typeof import('../../../server/src/security/container');
type DatabaseModule = typeof import('../../../server/src/db/database');
type RunningHosted = Awaited<ReturnType<HostedModule['startHosted']>>;
export type NodeDiaryDb = Awaited<ReturnType<DatabaseModule['DiaryDb']['fromImage']>>;

/** Cheap scrypt parameters for the test accounts (the formats do not depend on them). */
export const FAST_KDF = { N: 1024, r: 8, p: 1 };
/** A fictional, fixed device key (base64 of 32 bytes): the sealed secret of the platform, here a test value. */
export const TEST_DEVICE_KEY = Buffer.alloc(32, 0x5a).toString('base64');
/** The test machine's own port, never used by a test. */
const FORBIDDEN_PORT = 47321;

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => (port === FORBIDDEN_PORT ? freePort().then(resolve, reject) : resolve(port)));
    });
  });
}

export interface HostedRigOptions {
  /** `DIARY_MAX_DIARY_BYTES` (L6 only). */
  maxDiaryBytes?: number;
}

export class HostedRig {
  base = '';
  port = 0;
  dataDir = '';
  restarts = 0;
  private native: NativeServer | null = null;
  private running: RunningHosted | null = null;
  private hosted!: HostedModule;
  private config!: ConfigModule;

  constructor(private readonly opts: HostedRigOptions = {}) {}

  async open(): Promise<void> {
    this.native = await openNativeServer();
    this.hosted = await this.native.load<HostedModule>('hosted');
    this.config = await this.native.load<ConfigModule>('config');
    this.port = await freePort();
    this.base = `http://127.0.0.1:${this.port}`;
    this.dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpd-offline-e2e-'));
    await this.start();
  }

  private env(): Record<string, string> {
    return {
      DIARY_MODE: 'hosted',
      // http is accepted for a loopback public address only (tests); the real server is https.
      DIARY_PUBLIC_URL: this.base,
      DIARY_BIND: '127.0.0.1',
      PORT: String(this.port),
      DIARY_DEVICE_KEY: TEST_DEVICE_KEY,
      DIARY_LOGIN_PER_MINUTE: '1000',
      DIARY_AUTH_GLOBAL_PER_MINUTE: '5000',
      ...(this.opts.maxDiaryBytes ? { DIARY_MAX_DIARY_BYTES: String(this.opts.maxDiaryBytes) } : {}),
    };
  }

  private async start(): Promise<void> {
    const env = this.config.loadHostedEnv(this.env());
    const serverConfig = this.config.loadConfig(['--data-dir', this.dataDir], { DIARY_MODE: 'hosted' });
    let lastError: unknown = null;
    // The port of the previous listener may need a moment after a restart.
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        this.running = await this.hosted.startHosted(serverConfig, env, { port: this.port, bind: '127.0.0.1', quiet: true, auth: { kdf: FAST_KDF } });
        return;
      } catch (e) {
        lastError = e;
        if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw e;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    throw lastError;
  }

  /** Stops the server (the data directory stays). */
  async stop(): Promise<void> {
    const r = this.running;
    this.running = null;
    await r?.stop();
  }

  /** A server restart on the same data directory and port. */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
    this.restarts++;
  }

  get isRunning(): boolean {
    return this.running !== null;
  }

  async close(): Promise<void> {
    await this.stop();
    await this.native?.close();
    this.native = null;
    if (this.dataDir) fs.rmSync(this.dataDir, { recursive: true, force: true });
  }

  /** The account's diary as it is ON DISK right now (decrypted with the account password). Close it after use. */
  async diskDiary(userId: string, password: string): Promise<NodeDiaryDb> {
    if (!this.native) throw new Error('rig not open');
    const container = await this.native.load<ContainerModule>('security/container');
    const database = await this.native.load<DatabaseModule>('db/database');
    const accounts = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'accounts.json'), 'utf8')) as { accounts: Array<{ id: string; dbFile: string }> };
    const record = accounts.accounts.find((a) => a.id === userId);
    if (!record) throw new Error(`account ${userId} is not on disk`);
    const { plain } = await container.decryptWithPassword(fs.readFileSync(path.join(this.dataDir, 'users', record.dbFile)), password);
    return database.DiaryDb.fromImage(plain);
  }

  /** One query against the on-disk diary. */
  async onDisk<T>(userId: string, password: string, read: (db: NodeDiaryDb) => T): Promise<T> {
    const db = await this.diskDiary(userId, password);
    try {
      return read(db);
    } finally {
      db.close();
    }
  }
}
