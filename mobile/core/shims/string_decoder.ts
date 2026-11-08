/**
 * `node:string_decoder` stub of the Android core. Its only user is the Node SMTP client
 * (server/src/mail/node-transport.ts), which is never part of the core.
 */
import { stubClass } from './unavailable';

export const StringDecoder = stubClass('string_decoder', 'StringDecoder');

export default { StringDecoder };
