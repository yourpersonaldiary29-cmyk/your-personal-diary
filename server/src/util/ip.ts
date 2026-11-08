/**
 * IP literal checks without node:net - for modules that also run inside the Android build
 * (a Web Worker has no node:net). Same answers as `net.isIPv4` (test/util-ip.test.ts).
 */

/** Four decimal numbers 0-255 without leading zeros, separated by dots. */
const IPV4 = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** True for a dotted-quad IPv4 literal. */
export function isIPv4(value: string): boolean {
  return typeof value === 'string' && IPV4.test(value);
}
