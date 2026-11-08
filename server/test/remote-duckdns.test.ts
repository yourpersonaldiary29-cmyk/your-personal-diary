/**
 * DuckDNS client (server/src/remote/duckdns.ts) against an in-process mock (http on 127.0.0.1).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { t } from '@shared/i18n';
import { clearTxt, parseDuckDnsAnswer, setTxt, subdomainOf, updateIp } from '../src/remote/duckdns';
import { errorDetail } from '../src/remote/errors';
import { startMockDuckDns, type MockDuckDns } from './remote-fixtures';

const TOKEN = '0123abcd-4567-89ab-cdef-0123456789ab';
const HOST = 'diarytest.duckdns.org';

let duck: MockDuckDns;
beforeAll(async () => {
  duck = await startMockDuckDns({ token: TOKEN, domain: 'diarytest', ip: '198.51.100.4' });
});
afterAll(async () => {
  await duck.close();
});

describe('DuckDNS client', () => {
  it('sends domains=<sub>&token&ip=&verbose=true and reads the IP DuckDNS reports', async () => {
    const r = await updateIp(HOST, TOKEN, undefined, { baseUrl: duck.baseUrl });
    expect(r).toEqual({ ok: true, value: '198.51.100.4', change: 'UPDATED' });
    const q = duck.calls[duck.calls.length - 1];
    expect(q.get('domains')).toBe('diarytest');
    expect(q.get('token')).toBe(TOKEN);
    expect(q.get('ip')).toBe('');
    expect(q.get('verbose')).toBe('true');
  });

  it('passes an explicit IP', async () => {
    const r = await updateIp(HOST, TOKEN, '192.0.2.10', { baseUrl: duck.baseUrl });
    expect(r.value).toBe('192.0.2.10');
    expect(duck.calls[duck.calls.length - 1].get('ip')).toBe('192.0.2.10');
  });

  it('KO (wrong token) is ok:false, not an exception', async () => {
    const r = await updateIp(HOST, 'ffffffff-ffff-ffff-ffff-ffffffffffff', undefined, { baseUrl: duck.baseUrl });
    expect(r.ok).toBe(false);
  });

  it('sets and clears the TXT record', async () => {
    const set = await setTxt(HOST, TOKEN, 'proof-value_1', { baseUrl: duck.baseUrl });
    expect(set).toMatchObject({ ok: true, value: 'proof-value_1' });
    expect(duck.txt).toBe('proof-value_1');
    expect(duck.txtFor('_acme-challenge.diarytest.duckdns.org')).toBe('proof-value_1');
    const cleared = await clearTxt(HOST, TOKEN, { baseUrl: duck.baseUrl });
    expect(cleared.ok).toBe(true);
    const q = duck.calls[duck.calls.length - 1];
    expect(q.get('clear')).toBe('true');
    expect(q.get('txt')).toBe('removed');
    expect(duck.txt).toBeNull();
  });

  it('never puts the token into an error message', async () => {
    // Nothing listens on port 9 of 127.0.0.1 -> connection refused.
    let message = '';
    try {
      await updateIp(HOST, TOKEN, undefined, { baseUrl: 'http://127.0.0.1:9', timeoutMs: 3000 });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toBe('');
    expect(message).not.toContain(TOKEN);
  });

  it('a timeout keeps a catalogue key for its detail (no English text inside translated messages)', async () => {
    // A listener that accepts the connection and never answers.
    const sockets: net.Socket[] = [];
    const silent = net.createServer((socket) => {
      sockets.push(socket);
    });
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', () => resolve()));
    const port = (silent.address() as AddressInfo).port;
    let caught: unknown = null;
    try {
      await updateIp(HOST, TOKEN, undefined, { baseUrl: `http://127.0.0.1:${port}`, timeoutMs: 1000 });
    } catch (e) {
      caught = e;
    } finally {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => silent.close(() => resolve()));
    }
    expect(errorDetail(caught, [TOKEN])).toEqual({ detail: 'server.remote.detail.timeout', seconds: 1 });
    expect(t('he', 'server.remote.step.duckdns.failed', errorDetail(caught))).not.toMatch(/timed out/);
    // Anything else (an operating-system error) keeps its own short text.
    expect(errorDetail(new Error('connect ECONNREFUSED 127.0.0.1:9'))).toEqual({ detail: 'connect ECONNREFUSED 127.0.0.1:9' });
  });

  it('reaches DuckDNS over IPv4 even when the name also resolves to IPv6 (DuckDNS detects IPv4 only)', async () => {
    // A dual-stack listener that answers with the caller's address; 'localhost' resolves to ::1
    // and 127.0.0.1 on Windows, so without family 4 the request could arrive over IPv6.
    const server = http.createServer((req, res) => res.end(`OK\n${req.socket.remoteAddress ?? ''}\n\nUPDATED`));
    const port = await new Promise<number>((resolve, reject) => {
      server.once('error', () => {
        // No IPv6 on this machine: plain IPv4 listener (the request is IPv4 anyway).
        server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
      });
      server.listen({ port: 0, host: '::', ipv6Only: false }, () => resolve((server.address() as AddressInfo).port));
    }).catch(() => 0);
    try {
      expect(port).toBeGreaterThan(0);
      const r = await updateIp(HOST, TOKEN, undefined, { baseUrl: `http://localhost:${port}` });
      expect(r.ok).toBe(true);
      expect(net.isIPv4((r.value ?? '').replace(/^::ffff:/i, ''))).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('subdomainOf / parseDuckDnsAnswer', () => {
    expect(subdomainOf('YourPersonalDiary.duckdns.org')).toBe('yourpersonaldiary');
    expect(subdomainOf('www.yourpersonaldiary.duckdns.org.')).toBe('yourpersonaldiary');
    expect(subdomainOf('yourpersonaldiary')).toBe('yourpersonaldiary');
    expect(parseDuckDnsAnswer('KO')).toEqual({ ok: false, value: null, change: null });
    expect(parseDuckDnsAnswer('OK\r\n1.2.3.4\r\n\r\nNOCHANGE')).toEqual({ ok: true, value: '1.2.3.4', change: 'NOCHANGE' });
    expect(parseDuckDnsAnswer('OK')).toEqual({ ok: true, value: null, change: null });
  });
});
