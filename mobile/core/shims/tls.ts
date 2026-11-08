/**
 * `node:tls` stub of the Android core. E-mail is sent by the native diary-mail plugin (WP-12)
 * through the injected mail transport; server/src/mail/node-transport.ts - the only user of
 * node:tls outside remote access - is never part of the core.
 */
import { stubClass, stubFunction } from './unavailable';

export const connect = stubFunction('tls', 'connect');
export const createServer = stubFunction('tls', 'createServer');
export const createSecureContext = stubFunction('tls', 'createSecureContext');
export const TLSSocket = stubClass('tls', 'TLSSocket');

export default { connect, createServer, createSecureContext, TLSSocket };
