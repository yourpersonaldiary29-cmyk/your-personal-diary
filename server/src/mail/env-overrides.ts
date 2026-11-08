/**
 * Test overrides of the mail sending, read from the environment by the server entry point
 * (index.ts) - for end-to-end runs of the real server against a local mock SMTP server:
 *
 *   MPD_SMTP_CONNECT_HOST  TCP target of the SMTP connection (instead of the configured host);
 *                          must be this computer: 127.0.0.1 / ::1 / localhost
 *   MPD_SMTP_CA_FILE       PEM file of the CA that signed the mock server's certificate
 *
 * The CA is honoured ONLY together with a loopback connect host, so no environment variable can
 * make the app trust another certificate for a real mail server (e.g. smtp.gmail.com) - the SMTP
 * password could otherwise be intercepted. Certificate validation itself is never switched off.
 * Nothing is overridden in normal use.
 */
import fs from 'node:fs';
import type { MailServiceOptions } from './service';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

export interface MailEnvOverrides {
  options: MailServiceOptions;
  /** One human-readable line per applied or ignored override (for server.log). */
  notes: string[];
}

export function mailOverridesFromEnv(env: NodeJS.ProcessEnv): MailEnvOverrides {
  const notes: string[] = [];
  const connect = env.MPD_SMTP_CONNECT_HOST?.trim();
  const caFile = env.MPD_SMTP_CA_FILE?.trim();
  if (!connect && !caFile) return { options: {}, notes };
  if (!connect || !LOOPBACK_HOSTS.has(connect)) {
    notes.push('MPD_SMTP_CONNECT_HOST / MPD_SMTP_CA_FILE ignored: the SMTP test override must point at this computer (127.0.0.1)');
    return { options: {}, notes };
  }
  const smtp: NonNullable<MailServiceOptions['smtp']> = { connectHost: connect };
  notes.push(`TEST OVERRIDE: SMTP connections go to ${connect}`);
  if (caFile) {
    try {
      smtp.ca = fs.readFileSync(caFile, 'utf8');
      notes.push('TEST OVERRIDE: SMTP certificates are checked against the test CA file');
    } catch {
      notes.push('MPD_SMTP_CA_FILE ignored: the file could not be read');
    }
  }
  return { options: { smtp }, notes };
}
