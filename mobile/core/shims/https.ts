/**
 * `node:https` stub of the Android core (remote access - the only user - does not exist on the
 * phone). Importable; every member throws "not available on mobile" when called.
 */
import { stubClass, stubFunction } from './unavailable';

export const createServer = stubFunction('https', 'createServer');
export const request = stubFunction('https', 'request');
export const get = stubFunction('https', 'get');
export const Agent = stubClass('https', 'Agent');
export const Server = stubClass('https', 'Server');

export default { createServer, request, get, Agent, Server };
