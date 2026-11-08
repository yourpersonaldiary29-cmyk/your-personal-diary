/** `node:dns` stub of the Android core (remote access only). Importable; throws when called. */
import { stubClass, stubFunction } from './unavailable';

export const lookup = stubFunction('dns', 'lookup');
export const resolve = stubFunction('dns', 'resolve');
export const resolve4 = stubFunction('dns', 'resolve4');
export const resolve6 = stubFunction('dns', 'resolve6');
export const resolveTxt = stubFunction('dns', 'resolveTxt');
export const Resolver = stubClass('dns', 'Resolver');
export const promises = { lookup, resolve, resolve4, resolve6, resolveTxt, Resolver };

export default { lookup, resolve, resolve4, resolve6, resolveTxt, Resolver, promises };
