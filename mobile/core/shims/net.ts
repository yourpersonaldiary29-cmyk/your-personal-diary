/**
 * `node:net` of the Android core: the address classifiers (pure string functions, the same
 * patterns as Node) work; sockets and servers do not exist - no module the core loads opens one
 * (the Node SMTP client and the host check are never part of the core).
 */
import { stubClass, stubFunction } from './unavailable';

const V4_SEGMENT = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)';
const V4 = `(?:${V4_SEGMENT}\\.){3}${V4_SEGMENT}`;
const V4_PATTERN = new RegExp(`^${V4}$`);

const V6_SEGMENT = '(?:[0-9a-fA-F]{1,4})';
const V6_PATTERN = new RegExp(
  '^(?:' +
    `(?:${V6_SEGMENT}:){7}(?:${V6_SEGMENT}|:)|` +
    `(?:${V6_SEGMENT}:){6}(?:${V4}|:${V6_SEGMENT}|:)|` +
    `(?:${V6_SEGMENT}:){5}(?::${V4}|(?::${V6_SEGMENT}){1,2}|:)|` +
    `(?:${V6_SEGMENT}:){4}(?:(?::${V6_SEGMENT}){0,1}:${V4}|(?::${V6_SEGMENT}){1,3}|:)|` +
    `(?:${V6_SEGMENT}:){3}(?:(?::${V6_SEGMENT}){0,2}:${V4}|(?::${V6_SEGMENT}){1,4}|:)|` +
    `(?:${V6_SEGMENT}:){2}(?:(?::${V6_SEGMENT}){0,3}:${V4}|(?::${V6_SEGMENT}){1,5}|:)|` +
    `(?:${V6_SEGMENT}:){1}(?:(?::${V6_SEGMENT}){0,4}:${V4}|(?::${V6_SEGMENT}){1,6}|:)|` +
    `(?::(?:(?::${V6_SEGMENT}){0,5}:${V4}|(?::${V6_SEGMENT}){1,7}|:))` +
    ')(?:%[0-9a-zA-Z-.:]{1,})?$',
);

export function isIPv4(input: string): boolean {
  return V4_PATTERN.test(`${input}`);
}

export function isIPv6(input: string): boolean {
  return V6_PATTERN.test(`${input}`);
}

/** 4, 6 or 0 (not an IP address). */
export function isIP(input: string): number {
  if (isIPv4(input)) return 4;
  if (isIPv6(input)) return 6;
  return 0;
}

export const connect = stubFunction('net', 'connect');
export const createConnection = stubFunction('net', 'createConnection');
export const createServer = stubFunction('net', 'createServer');
export const Socket = stubClass('net', 'Socket');
export const Server = stubClass('net', 'Server');

export default { isIP, isIPv4, isIPv6, connect, createConnection, createServer, Socket, Server };
