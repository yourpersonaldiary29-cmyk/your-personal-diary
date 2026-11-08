/** util/ip.ts replaces `net.isIPv4` in modules that must not import node:net: same answers. */
import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { normalizeMailHost } from '../src/mail/settings';
import { isIPv4 } from '../src/util/ip';

const SAMPLES = [
  '0.0.0.0',
  '127.0.0.1',
  '10.0.0.1',
  '192.168.1.255',
  '255.255.255.255',
  '1.2.3.4',
  '9.99.199.249',
  '256.1.1.1',
  '1.256.1.1',
  '1.1.1.256',
  '300.300.300.300',
  '01.2.3.4',
  '1.02.3.4',
  '1.2.3.04',
  '00.0.0.0',
  '1.2.3',
  '1.2.3.4.5',
  '1..2.3',
  '.1.2.3',
  '1.2.3.',
  '1.2.3.4 ',
  ' 1.2.3.4',
  '1.2.3.4\n',
  '',
  'localhost',
  'smtp.gmail.com',
  '::1',
  '::ffff:127.0.0.1',
  '1.2.3.a',
  '0x7f.0.0.1',
  '1e1.0.0.1',
  '+1.2.3.4',
  '-1.2.3.4',
  '1,2,3,4',
  '١.٢.٣.٤',
  '1.2.3.4/24',
  '999.0.0.1',
  '25.25.25.25',
  '250.251.252.253',
  '199.200.249.250',
];

describe('isIPv4', () => {
  it('answers exactly like net.isIPv4', () => {
    for (const s of SAMPLES) expect({ s, ok: isIPv4(s) }).toEqual({ s, ok: net.isIPv4(s) });
    for (let i = 0; i < 2000; i++) {
      const s = [i % 300, (i * 7) % 260, (i * 13) % 257, (i * 31) % 256].join('.');
      expect({ s, ok: isIPv4(s) }).toEqual({ s, ok: net.isIPv4(s) });
    }
  });

  it('keeps the mail host normalisation as it was (an IPv4 literal is a host, a bare word is not)', () => {
    expect(normalizeMailHost('127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeMailHost(' SMTP.Gmail.com. ')).toBe('smtp.gmail.com');
    expect(normalizeMailHost('localhost')).toBe('localhost');
    expect(normalizeMailHost('mailhost')).toBeNull();
    expect(normalizeMailHost('')).toBeNull();
  });
});
