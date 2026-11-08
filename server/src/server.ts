/**
 * Server lifecycle: port selection, loopback + optional LAN listeners, optional remote access
 * (HTTPS), graceful stop.
 *
 * Network policy: always listens on 127.0.0.1. A second listener on 0.0.0.0 is opened only
 * while `lanEnabled` is true (phone access on the home network). While remote access is on
 * (opt-in, off by default) the remote manager adds an HTTPS listener and opens outbound
 * connections (DuckDNS, Let's Encrypt, the home router over UPnP). The only other outbound
 * connection is the mail service (password reset by e-mail, opt-in, off by default): it talks to
 * the SMTP host the owner configured, only when an e-mail is sent. Otherwise the server never
 * opens outbound connections.
 *
 * Every listener serves the same handler: the host check (active while remote access is on)
 * in front of the Express app.
 *
 * Prints one JSON line per lifecycle event to stdout so the desktop shell can discover the port:
 *   {"event":"listening","port":47321,"lanEnabled":false,"dataDir":"..."}
 */
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import type { ServerSettings } from '@shared/types';
import { createApp, type AppDeps } from './app';
import { readServerSettings, writeServerSettings, type ServerConfig } from './config';
import { nodeSmtpTransport } from './mail/node-transport';
import { MailService, type MailServiceOptions } from './mail/service';
import type { SmtpTransport } from './mail/transport';
import { hostCheck } from './middleware/host-check';
import { RemoteManager, type RemoteManagerOptions } from './remote/manager';
import type { PasswordResetController } from './routes/auth';
import type { MailController, RemoteController } from './routes/server';
import { createAuthService, type AuthServiceOptions } from './security/auth-service';
import { loadOrCreateDeviceKey } from './security/device-key';
import { firstAccountId } from './security/owner';
import { PasswordResetService, type PasswordResetOptions } from './security/password-reset';

export function emit(event: string, data: Record<string, unknown> = {}): void {
  process.stdout.write(JSON.stringify({ event, ...data }) + '\n');
}

export function lanUrls(port: number): string[] {
  const urls: string[] = [];
  for (const [, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) urls.push(`http://${a.address}:${port}`);
    }
  }
  return urls;
}

function isPortFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, host);
  });
}

async function pickPort(preferred: number): Promise<number> {
  if (preferred > 0 && (await isPortFree(preferred, '127.0.0.1'))) return preferred;
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : preferred;
      srv.close(() => resolve(port));
    });
  });
}

function listen(server: http.Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
}

function closeServer(server: http.Server | null): Promise<void> {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
}

export interface RunningServer {
  port: number;
  config: ServerConfig;
  getSettings(): ServerSettings;
  /** The remote-access manager (status, commands). */
  remote: RemoteManager;
  /** Sending e-mail (password reset). */
  mail: MailService;
  /** "Forgot password?" (tests await `idle()` for the background e-mails). */
  passwordReset: PasswordResetService;
  stop(): Promise<void>;
}

export interface StartOptions {
  /** Override the port (tests pass 0 for a random free port). */
  port?: number;
  /** Do not print lifecycle events (tests). */
  quiet?: boolean;
  /** Remote-access overrides (tests: mock DuckDNS / ACME / SSDP endpoints, local TLS port). */
  remote?: RemoteManagerOptions;
  /** Mail overrides (tests: the CA and address of the local mock SMTP server). */
  mail?: MailServiceOptions;
  /**
   * Carries out the SMTP conversation instead of the node:net / node:tls client
   * (mail/node-transport.ts, the default) - see mail/transport.ts.
   */
  mailTransport?: SmtpTransport;
  /** Account service options (tests: cheaper scrypt parameters, a clock, shorter reset links). */
  auth?: AuthServiceOptions;
  /** Password-reset rate limits / clock (tests). */
  passwordReset?: PasswordResetOptions;
}

export async function startServer(config: ServerConfig, opts: StartOptions = {}): Promise<RunningServer> {
  const say = opts.quiet ? () => {} : emit;
  let settings: ServerSettings = readServerSettings(config);
  const port = await pickPort(opts.port ?? (settings.port || config.preferredPort));
  const startedAt = new Date().toISOString();
  const auth = await createAuthService(config, opts.auth);
  const deviceKey = loadOrCreateDeviceKey(config.deviceKeyFile);
  // The owner of this computer's diary (remote access, sending e-mail): the first account created.
  const firstAccount = () => firstAccountId(auth.listAccounts());
  // Password reset by e-mail: the owner's SMTP settings + the reset links / codes.
  const mail = new MailService({
    config,
    deviceKey,
    firstAccountId: firstAccount,
    transport: opts.mailTransport ?? nodeSmtpTransport,
    options: { ...(opts.quiet ? { log: () => {} } : {}), ...opts.mail },
  });
  const passwordReset = new PasswordResetService(auth, mail, {
    ...(opts.quiet ? { log: () => {} } : {}),
    ...opts.passwordReset,
  });
  const mailController: MailController = mail;
  const resetController: PasswordResetController = passwordReset;

  let lanServer: http.Server | null = null;
  // Assigned right below, before any listener exists; the closures only run on requests.
  let remote: RemoteManager;

  const remoteController: RemoteController = {
    status: () => remote.status(),
    update: (body, actorId) => remote.update(body, actorId),
    renew: () => remote.renew(),
    test: (body) => remote.test(body),
    settings: () => remote.settings(),
    info: () => remote.info(),
    ownerId: () => remote.ownerId(),
    releaseOwner: (userId) => remote.releaseOwner(userId),
    pinOwner: () => remote.pinOwner(),
  };

  const deps: AppDeps & { remote: RemoteController; mail: MailController; passwordReset: PasswordResetController } = {
    config,
    auth,
    getServerSettings: () => ({ ...settings, remote: remote.settings() }),
    setServerSettings: async (next: ServerSettings) => {
      settings = { port: next.port, lanEnabled: next.lanEnabled };
      writeServerSettings(config, settings);
      if (settings.lanEnabled) await openLan();
      else await closeLan();
      return { ...settings, remote: remote.settings() };
    },
    getListenInfo: () => ({ port, lanUrls: lanServer ? lanUrls(port) : [], startedAt }),
    remote: remoteController,
    mail: mailController,
    passwordReset: resetController,
  };
  const app = createApp(deps);
  const guardHost = hostCheck(() => remote.hostPolicy());
  const handler: http.RequestListener = (req, res) => guardHost(req, res, () => app(req, res));

  remote = new RemoteManager({
    config,
    deviceKey,
    firstAccountId: firstAccount,
    handler,
    options: {
      emit: opts.quiet ? undefined : say,
      log: opts.quiet ? () => {} : undefined,
      ...opts.remote,
    },
  });

  async function openLan(): Promise<void> {
    if (lanServer) return;
    const s = http.createServer(handler);
    try {
      await listen(s, port, '0.0.0.0');
      lanServer = s;
      say('lan', { enabled: true, urls: lanUrls(port) });
    } catch (e) {
      say('lan-error', { message: (e as Error).message });
    }
  }
  async function closeLan(): Promise<void> {
    if (!lanServer) return;
    const s = lanServer;
    lanServer = null;
    await closeServer(s);
    say('lan', { enabled: false, urls: [] });
  }

  const localServer = http.createServer(handler);
  await listen(localServer, port, '127.0.0.1');
  if (settings.lanEnabled) await openLan();
  say('listening', { port, lanEnabled: !!lanServer, dataDir: config.dataDir });
  // Remote access set up by an account that no longer exists - or stored with an owner that is not an
  // account id at all (UNREADABLE_OWNER) - is turned off and forgotten (owner, DuckDNS token, name,
  // certificate) instead of resuming: nobody could manage it any more.
  const owner = remote.ownerId();
  if (owner && !auth.listAccounts().some((a) => a.id === owner)) await remote.releaseOwner(owner);
  // The same for the mail settings: an owner account that is gone takes them with it.
  const mailOwner = mail.ownerId();
  if (mailOwner && !auth.listAccounts().some((a) => a.id === mailOwner)) mail.releaseOwner(mailOwner);
  // Both belong to the first account created on this computer - except settings saved earlier by
  // another account, which keep that owner (never transferred silently; one log line each).
  // Settings without a stored owner are written down as the first account's here - or, when there
  // is no account yet, right after the first one is registered (routes/auth.ts).
  await remote.checkOwner();
  mail.checkOwner();
  // Remote access resumes in the background (the certificate may take a while).
  remote.resume();

  let stopped = false;
  return {
    port,
    config,
    getSettings: () => ({ ...settings, remote: remote.settings() }),
    remote,
    mail,
    passwordReset,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      await remote.shutdown();
      await closeLan();
      await closeServer(localServer);
      // Give e-mails being handed over a moment (each SMTP step has its own timeout anyway).
      await Promise.race([passwordReset.idle(), new Promise((r) => setTimeout(r, 3000).unref?.())]);
      await auth.shutdown();
      say('stopped');
    },
  };
}
