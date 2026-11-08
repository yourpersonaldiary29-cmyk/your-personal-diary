/**
 * "Not available on mobile": the error every stubbed Node API of the Android core throws when it
 * is CALLED. Importing a stub is always fine - server modules import node:os, node:net, ... at
 * module scope, and only code paths the mobile core never takes actually call them.
 */

/** `err.code` of every "not available on mobile" error. */
export const MOBILE_UNAVAILABLE_CODE = 'ERR_MOBILE_UNAVAILABLE';

export class MobileUnavailableError extends Error {
  readonly code = MOBILE_UNAVAILABLE_CODE;
  /** What was asked for, e.g. "node:net createServer()". */
  readonly feature: string;

  constructor(feature: string) {
    super(`${feature} is not available on mobile (the Android core runs in a Web Worker, without Node.js)`);
    this.name = 'MobileUnavailableError';
    this.feature = feature;
  }
}

/** Throws the "not available on mobile" error of `<module>.<member>`. */
export function unavailable(module: string, member: string): never {
  throw new MobileUnavailableError(`node:${module} ${member}`);
}

/** A function that can be imported and passed around, and throws when called. */
export function stubFunction(module: string, member: string): (...args: unknown[]) => never {
  return function mobileStub(): never {
    return unavailable(module, `${member}()`);
  };
}

/** A class that can be imported (also as a type position value), and throws when constructed. */
export function stubClass(module: string, member: string): new (...args: unknown[]) => never {
  return class MobileStub {
    constructor() {
      unavailable(module, `new ${member}()`);
    }
  } as unknown as new (...args: unknown[]) => never;
}
