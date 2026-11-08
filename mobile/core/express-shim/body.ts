/**
 * The body parsers of the express shim: `express.json()` as server/src/app.ts uses it (one per
 * route group, each with its own `limit`), plus `raw()` and `text()` for completeness. The rules
 * are body-parser's, so the error middleware of the server (middleware/error.ts) recognises the
 * failures by their `type`:
 *
 *  - no body, or a body of another media type: the parser steps aside and `req.body` stays as it
 *    was (undefined - the routes read `req.body ?? {}`). The media type must be the one asked for:
 *    `express.json()` parses 'application/json' and nothing else - not 'application/vnd.api+json'
 *    (Express's default `type` does not match '+json' suffixes; pass such a type to get it);
 *  - a byte order mark at the start of a textual body is not part of the text (body-parser decodes
 *    with iconv-lite, which strips it), so JSON that follows one parses;
 *  - a body above `limit` ('100kb', '2mb', '25mb'): 413 `entity.too.large`;
 *  - a charset other than UTF-8: 415 `charset.unsupported`;
 *  - JSON that does not parse, or (strict) does not start with '{' or '[': 400 `entity.parse.failed`;
 *  - a parser never runs twice on one request (`req._body`).
 */
import { Buffer } from '../shims/buffer';
import { charsetOf, matchesType, mediaTypeOf, type NextFunction, type Request, type Response } from './http';

export interface JsonOptions {
  /** Maximum body size ('100kb', '2mb', a number of bytes). Default: '100kb'. */
  limit?: string | number;
  /** Only accept objects and arrays. Default: true. */
  strict?: boolean;
  /** The media type(s) to parse ('application/json', '+json' for every '...+json' type, 'text/*'). Default: 'application/json' only. */
  type?: string | string[];
  /** JSON.parse reviver. */
  reviver?: (key: string, value: unknown) => unknown;
}

export interface RawOptions {
  limit?: string | number;
  /** Default: 'application/octet-stream'. */
  type?: string | string[];
}

export interface TextOptions {
  limit?: string | number;
  /** Default: 'text/plain'. */
  type?: string | string[];
}

export type BodyParser = (req: Request, res: Response, next: NextFunction) => void;

/** A body-parser style error: `status`, `type` and `expose`. */
export interface BodyError extends Error {
  status: number;
  statusCode: number;
  type: string;
  expose: boolean;
  [key: string]: unknown;
}

export function bodyError(status: number, message: string, type: string, extra: Record<string, unknown> = {}): BodyError {
  const error = new Error(message) as BodyError;
  error.status = status;
  error.statusCode = status;
  error.type = type;
  error.expose = status < 500;
  Object.assign(error, extra);
  return error;
}

const UNITS: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

/** '100kb' / '2mb' / 1024 -> bytes (the `bytes` package's rules, as body-parser uses them). */
export function parseLimit(limit: string | number | undefined, fallback: string): number {
  const value = limit ?? fallback;
  if (typeof value === 'number') return value;
  const match = /^\s*(\d+(?:\.\d+)?)\s*([kmg]?b)?\s*$/i.exec(value);
  if (!match) throw new TypeError(`invalid body limit: ${value}`);
  return Math.floor(Number(match[1]) * UNITS[(match[2] ?? 'b').toLowerCase()]);
}

const decoder = new TextDecoder('utf-8');
const encoder = new TextEncoder();

function byteLengthOf(body: string | Uint8Array): number {
  return typeof body === 'string' ? encoder.encode(body).byteLength : body.byteLength;
}

function typeMatches(req: Request, types: string[]): boolean {
  const mediaType = mediaTypeOf(req.headers['content-type']);
  return types.some((type) => matchesType(mediaType, type));
}

/** `text` without the byte order mark it may start with (U+FEFF; at most one, like a UTF-8 decoder). */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * The common part of the parsers: decides whether to parse, checks the limit and the charset and
 * hands the body to `parse`. `textual` parsers decode the bytes as UTF-8 first.
 */
function parser(types: string[], limitBytes: number, textual: boolean, parse: (body: string | Uint8Array, req: Request) => unknown): BodyParser {
  return function bodyParser(req, _res, next) {
    if (req._body || !req.hasBody() || !typeMatches(req, types)) return next();
    const raw = req.rawBody as string | Uint8Array;
    const charset = charsetOf(req.headers['content-type']);
    if (textual && charset && charset !== 'utf-8' && charset !== 'utf8') {
      return next(bodyError(415, `unsupported charset "${charset.toUpperCase()}"`, 'charset.unsupported', { charset }));
    }
    const length = byteLengthOf(raw);
    if (length > limitBytes) {
      return next(bodyError(413, 'request entity too large', 'entity.too.large', { expected: length, length, limit: limitBytes }));
    }
    req._body = true;
    let body: string | Uint8Array = raw;
    // Bytes: the decoder drops a leading BOM itself. Text (the host sent a string): drop it here.
    if (textual) body = typeof raw === 'string' ? stripBom(raw) : decoder.decode(raw);
    try {
      req.body = parse(body, req);
    } catch (e) {
      return next(e);
    }
    next();
  };
}

/** The first non-whitespace character of `text` ('' when there is none). */
function firstChar(text: string): string {
  const match = /^[\x20\x09\x0a\x0d]*(.)/.exec(text);
  return match ? match[1] : '';
}

/** `express.json(options)`. */
export function json(options: JsonOptions = {}): BodyParser {
  const limit = parseLimit(options.limit, '100kb');
  const strict = options.strict !== false;
  const types = typeof options.type === 'string' ? [options.type] : (options.type ?? ['application/json']);
  return parser(types, limit, true, (body) => {
    const text = body as string;
    if (text.length === 0) return {};
    if (strict) {
      const first = firstChar(text);
      if (first !== '{' && first !== '[') {
        throw bodyError(400, `Unexpected token ${JSON.stringify(first)} in JSON at position 0`, 'entity.parse.failed', { body: text });
      }
    }
    try {
      return JSON.parse(text, options.reviver);
    } catch (e) {
      throw bodyError(400, (e as Error).message, 'entity.parse.failed', { body: text });
    }
  });
}

/** `express.raw(options)`: the body as a Buffer (the core's Buffer class). */
export function raw(options: RawOptions = {}): BodyParser {
  const limit = parseLimit(options.limit, '100kb');
  const types = typeof options.type === 'string' ? [options.type] : (options.type ?? ['application/octet-stream']);
  return parser(types, limit, false, (body) => (typeof body === 'string' ? Buffer.from(body, 'utf8') : Buffer.from(body.buffer, body.byteOffset, body.byteLength)));
}

/** `express.text(options)`: the body as a string. */
export function text(options: TextOptions = {}): BodyParser {
  const limit = parseLimit(options.limit, '100kb');
  const types = typeof options.type === 'string' ? [options.type] : (options.type ?? ['text/plain']);
  return parser(types, limit, true, (body) => body as string);
}
