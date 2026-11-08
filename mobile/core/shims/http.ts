/**
 * `node:http` stub of the Android core: there is no HTTP server in the phone (requests arrive as
 * worker messages). No module the core loads uses it at run time (middleware/access.ts imports
 * only a type); the stub exists so that an accidental import fails with a clear message.
 */
import { stubClass, stubFunction } from './unavailable';

export const createServer = stubFunction('http', 'createServer');
export const request = stubFunction('http', 'request');
export const get = stubFunction('http', 'get');
export const Agent = stubClass('http', 'Agent');
export const Server = stubClass('http', 'Server');
export const IncomingMessage = stubClass('http', 'IncomingMessage');
export const ServerResponse = stubClass('http', 'ServerResponse');

export default { createServer, request, get, Agent, Server, IncomingMessage, ServerResponse };
