/** `node:dgram` stub of the Android core (UPnP of remote access only). Importable; throws when called. */
import { stubFunction } from './unavailable';

export const createSocket = stubFunction('dgram', 'createSocket');

export default { createSocket };
