/**
 * The static network audit (scripts/check-no-network.mjs) still passes with remote access in the
 * code base: outbound code exists only in server/src/remote/ and names only the allowed hosts.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'scripts', 'check-no-network.mjs');

describe('check-no-network', () => {
  it('passes, and names the only hosts remote access may contact', () => {
    const out = execFileSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('Network audit passed');
    for (const host of ['acme-v02.api.letsencrypt.org', 'acme-staging-v02.api.letsencrypt.org', 'www.duckdns.org']) expect(out).toContain(host);
  });

  it('the remote module is the only server code importing node:https / node:dgram', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (/\.ts$/.test(name) && /from ['"](node:)?(https|dgram)['"]/.test(fs.readFileSync(full, 'utf8'))) offenders.push(path.relative(root, full).split(path.sep).join('/'));
      }
    };
    walk(path.join(root, 'server', 'src'));
    expect(offenders.every((f) => f.startsWith('server/src/remote/'))).toBe(true);
    expect(offenders.sort()).toEqual(['server/src/remote/http.ts', 'server/src/remote/tls.ts', 'server/src/remote/upnp.ts']);
  });
});
