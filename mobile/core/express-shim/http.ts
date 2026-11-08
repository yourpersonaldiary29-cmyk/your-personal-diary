/**
 * The request and response objects of the express shim (mobile/core/express-shim): what the
 * routers in server/src/routes/*.ts, the middleware in server/src/middleware/*.ts and app.ts read
 * and write on Express 5's `req` / `res`, with the same semantics - and nothing from node:http.
 *
 * A `Request` is built from one message of the host (method, path + query, lower-case headers,
 * an optional text or bytes body); a `Response` collects status, headers and body and resolves
 * its `done` promise when the handler ends it. The worker turns both into the host protocol
 * (./dispatch.ts).
 *
 * Request members (inventory of server/src): method, url, originalUrl, baseUrl, path, params,
 * query, body, headers, header() / get(), ip, socket.remoteAddress, socket.encrypted, is().
 * Response members: status, sendStatus, json, send, end, write, set / header / setHeader, get /
 * getHeader, hasHeader, removeHeader, getHeaders, type, attachment, writeHead, on / once
 * ('finish', 'close'), headersSent, statusCode, locals.
 */
import { parseQuery, type ParsedQuery } from './query';

export type NextFunction = (err?: unknown) => void;

/** Loopback: every request of the phone's UI is "local" (markLocal in server/src/middleware/access.ts). */
export const LOOPBACK_ADDRESS = '127.0.0.1';

export interface RequestInit {
  /** HTTP method, any case. */
  method: string;
  /** Path and query, e.g. `/api/entries?limit=5`. */
  url: string;
  /** Header map; names are lower-cased here. */
  headers?: Record<string, string>;
  /** The raw body (text or bytes); none means "no body". */
  body?: string | Uint8Array;
  /** The address the request "came from". Default: loopback. */
  remoteAddress?: string;
}

/** The part of Node's socket the server middleware reads. */
export interface RequestSocket {
  remoteAddress: string;
  remoteFamily: 'IPv4' | 'IPv6';
  /** The desktop's HTTPS listener sets this; the phone has no TLS listener. */
  encrypted: false;
}

export type HttpMethod = string;

/** Status texts of the codes the shim may produce itself. */
export const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  423: 'Locked',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

/** `res.type()` short names (what `mime-types` gives Express for them). */
const TYPE_SHORTCUTS: Record<string, string> = {
  json: 'application/json; charset=utf-8',
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  text: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  xml: 'application/xml',
  pdf: 'application/pdf',
  bin: 'application/octet-stream',
  mpd: 'application/octet-stream',
  zip: 'application/zip',
  png: 'image/png',
  svg: 'image/svg+xml',
};

const encoder = new TextEncoder();

export function utf8Length(text: string): number {
  return encoder.encode(text).byteLength;
}

/** The media type of a Content-Type value, lower-cased, without parameters. */
export function mediaTypeOf(contentType: string | undefined): string {
  if (!contentType) return '';
  return contentType.split(';')[0].trim().toLowerCase();
}

/** The charset parameter of a Content-Type value (lower-cased), or ''. */
export function charsetOf(contentType: string | undefined): string {
  if (!contentType) return '';
  const match = /;\s*charset\s*=\s*"?([^";]+)"?/i.exec(contentType);
  return match ? match[1].trim().toLowerCase() : '';
}

/** `type-is` for one media type: 'application/json', '*\/*+json', 'text/*', or a short name. */
export function matchesType(mediaType: string, pattern: string): boolean {
  if (!mediaType) return false;
  const expected = TYPE_SHORTCUTS[pattern] ? mediaTypeOf(TYPE_SHORTCUTS[pattern]) : pattern.toLowerCase();
  if (expected === mediaType) return true;
  if (expected.startsWith('+')) return mediaType.endsWith(expected);
  if (expected.startsWith('*/+')) return mediaType.endsWith(expected.slice(2));
  if (expected.endsWith('/*')) return mediaType.startsWith(expected.slice(0, -1));
  if (expected === '*/*') return true;
  return false;
}

function normalizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [name, value] of Object.entries(headers)) out[name.toLowerCase()] = String(value);
  return out;
}

export class Request {
  method: string;
  /** The current URL (path + query); routers trim their mount prefix off it while they run. */
  url: string;
  readonly originalUrl: string;
  baseUrl = '';
  params: Record<string, string> = {};
  /** Set by a body parser; undefined until one ran (as in Express 5). */
  body: unknown = undefined;
  readonly headers: Record<string, string>;
  readonly socket: RequestSocket;
  /** The body as the host sent it (read by the body parsers of ./body.ts). */
  readonly rawBody: string | Uint8Array | undefined;
  /** body-parser's flag: a body parser ran already. */
  _body = false;
  /** Set by the routers while they run (Express does the same). */
  route: unknown = undefined;
  next: NextFunction | undefined = undefined;
  /** Set by the application when it handles the request. */
  app: unknown = undefined;
  res: Response | undefined = undefined;
  private parsedQuery: ParsedQuery | null = null;

  constructor(init: RequestInit) {
    this.method = String(init.method || 'GET').toUpperCase();
    this.url = init.url.startsWith('/') ? init.url : `/${init.url}`;
    this.originalUrl = this.url;
    this.headers = normalizeHeaders(init.headers);
    const address = init.remoteAddress ?? LOOPBACK_ADDRESS;
    this.socket = { remoteAddress: address, remoteFamily: address.includes(':') ? 'IPv6' : 'IPv4', encrypted: false };
    this.rawBody = init.body;
  }

  /** The pathname of the current `url` (relative to the mount point while a router runs). */
  get path(): string {
    const cut = this.url.indexOf('?');
    return cut < 0 ? this.url : this.url.slice(0, cut);
  }

  /** The query string parsed like Express 5's default ('simple': node:querystring), once. */
  get query(): ParsedQuery {
    if (!this.parsedQuery) {
      const cut = this.originalUrl.indexOf('?');
      this.parsedQuery = parseQuery(cut < 0 ? '' : this.originalUrl.slice(cut + 1));
    }
    return this.parsedQuery;
  }

  get ip(): string {
    return this.socket.remoteAddress;
  }

  get ips(): string[] {
    return [];
  }

  get protocol(): string {
    return 'http';
  }

  get secure(): boolean {
    return false;
  }

  get hostname(): string {
    const host = this.headers.host ?? '';
    const cut = host.startsWith('[') ? host.indexOf(']') + 1 : host.indexOf(':');
    return cut > 0 ? host.slice(0, cut) : host;
  }

  get xhr(): boolean {
    return (this.headers['x-requested-with'] ?? '').toLowerCase() === 'xmlhttprequest';
  }

  /** The header value (case-insensitive); 'referer' and 'referrer' are the same header. */
  header(name: string): string | undefined {
    if (typeof name !== 'string') throw new TypeError('name must be a string to req.get');
    const lower = name.toLowerCase();
    if (lower === 'referer' || lower === 'referrer') return this.headers.referer ?? this.headers.referrer;
    return this.headers[lower];
  }

  get(name: string): string | undefined {
    return this.header(name);
  }

  /** `req.is(type)`: the matching type, false when the body has another type, null without a body. */
  is(...types: Array<string | string[]>): string | false | null {
    if (!this.hasBody()) return null;
    const mediaType = mediaTypeOf(this.headers['content-type']);
    for (const type of types.flat()) {
      if (matchesType(mediaType, type)) return type;
    }
    return false;
  }

  /** True when the host sent a body (`type-is.hasBody`: a non-empty body). */
  hasBody(): boolean {
    const body = this.rawBody;
    if (body === undefined) return false;
    return (typeof body === 'string' ? body.length : body.byteLength) > 0;
  }
}

/** What a finished response holds. */
export interface ResponseResult {
  status: number;
  /** Header names lower-cased. */
  headers: Record<string, string>;
  body: string | Uint8Array | null;
}

type Listener = (...args: unknown[]) => void;

export class Response {
  statusCode = 200;
  statusMessage = '';
  headersSent = false;
  finished = false;
  writableEnded = false;
  locals: Record<string, unknown> = {};
  app: unknown = undefined;
  req: Request | undefined = undefined;
  /** Resolves when the response was ended. */
  readonly done: Promise<ResponseResult>;

  private readonly headerMap = new Map<string, string>();
  private readonly chunks: Array<string | Uint8Array> = [];
  private readonly listeners = new Map<string, Listener[]>();
  private settle!: (result: ResponseResult) => void;

  constructor() {
    this.done = new Promise<ResponseResult>((resolve) => {
      this.settle = resolve;
    });
  }

  // Status ------------------------------------------------------------------

  status(code: number): this {
    if (!Number.isInteger(code) || code < 100 || code > 999) throw new RangeError(`Invalid status code: ${String(code)}`);
    this.statusCode = code;
    return this;
  }

  sendStatus(code: number): this {
    this.status(code);
    this.type('txt');
    return this.send(STATUS_TEXT[code] ?? String(code));
  }

  // Headers -----------------------------------------------------------------

  setHeader(name: string, value: string | number | readonly string[]): this {
    if (this.headersSent) throw new Error('Cannot set headers after they are sent to the client');
    const text = Array.isArray(value) ? value.join(', ') : String(value);
    this.headerMap.set(String(name).toLowerCase(), text);
    return this;
  }

  /** `res.set(name, value)` or `res.set({ name: value })` (Express names). */
  set(field: string | Record<string, string | number | readonly string[]>, value?: string | number | readonly string[]): this {
    if (typeof field === 'string') {
      this.setHeader(field, value ?? '');
      return this;
    }
    for (const [name, v] of Object.entries(field)) this.setHeader(name, v);
    return this;
  }

  header(field: string | Record<string, string | number | readonly string[]>, value?: string | number | readonly string[]): this {
    return this.set(field, value);
  }

  getHeader(name: string): string | undefined {
    return this.headerMap.get(String(name).toLowerCase());
  }

  get(name: string): string | undefined {
    return this.getHeader(name);
  }

  hasHeader(name: string): boolean {
    return this.headerMap.has(String(name).toLowerCase());
  }

  removeHeader(name: string): void {
    if (this.headersSent) throw new Error('Cannot remove headers after they are sent to the client');
    this.headerMap.delete(String(name).toLowerCase());
  }

  getHeaders(): Record<string, string> {
    return Object.fromEntries(this.headerMap);
  }

  getHeaderNames(): string[] {
    return [...this.headerMap.keys()];
  }

  /** Content-Type: a full type as given, or a short name ('json', 'html', 'txt', 'pdf', 'bin'...). */
  type(type: string): this {
    const value = type.includes('/') ? type : (TYPE_SHORTCUTS[type.replace(/^\./, '').toLowerCase()] ?? type);
    return this.setHeader('Content-Type', value);
  }

  contentType(type: string): this {
    return this.type(type);
  }

  /** Content-Disposition: attachment (RFC 6266; a non-ASCII name travels in `filename*`). */
  attachment(fileName?: string): this {
    if (fileName) {
      const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase() : '';
      if (extension && TYPE_SHORTCUTS[extension]) this.type(extension);
      const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
      const needsUtf8 = ascii !== fileName;
      this.setHeader('Content-Disposition', `attachment; filename="${ascii}"${needsUtf8 ? `; filename*=UTF-8''${encodeURIComponent(fileName)}` : ''}`);
    } else {
      this.setHeader('Content-Disposition', 'attachment');
    }
    return this;
  }

  writeHead(status: number, headers?: Record<string, string | number | readonly string[]>): this {
    this.status(status);
    if (headers) this.set(headers);
    return this;
  }

  // Body --------------------------------------------------------------------

  /** JSON body with `application/json; charset=utf-8` (what the desktop server answers with). */
  json(body: unknown): this {
    const text = JSON.stringify(body);
    if (!this.hasHeader('Content-Type')) this.setHeader('Content-Type', 'application/json');
    return this.send(text);
  }

  /**
   * `res.send`: a string (default text/html; a text type gets its charset), bytes (default
   * application/octet-stream), an object / number / boolean (JSON) or nothing. Sets Content-Length;
   * 204 / 304 answers lose their body and content headers.
   */
  send(body?: unknown): this {
    let chunk: string | Uint8Array | null = null;
    if (typeof body === 'string') {
      const type = this.getHeader('Content-Type');
      if (type === undefined) this.setHeader('Content-Type', 'text/html; charset=utf-8');
      else if (!/;\s*charset=/i.test(type) && (/^text\//i.test(type) || /json/i.test(type))) this.setHeader('Content-Type', `${type}; charset=utf-8`);
      chunk = body;
    } else if (body === undefined || body === null) {
      chunk = null;
    } else if (ArrayBuffer.isView(body)) {
      if (!this.hasHeader('Content-Type')) this.type('bin');
      chunk = body instanceof Uint8Array ? body : new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    } else if (body instanceof ArrayBuffer) {
      if (!this.hasHeader('Content-Type')) this.type('bin');
      chunk = new Uint8Array(body);
    } else {
      return this.json(body);
    }

    if (this.statusCode === 204 || this.statusCode === 304) {
      this.removeHeader('Content-Type');
      this.removeHeader('Content-Length');
      this.removeHeader('Transfer-Encoding');
      chunk = null;
    } else if (chunk !== null) {
      this.setHeader('Content-Length', String(typeof chunk === 'string' ? utf8Length(chunk) : chunk.byteLength));
    }
    if (this.req?.method === 'HEAD') chunk = null;
    return this.end(chunk);
  }

  /** Appends to the body (streams in Node); the response is sent when `end()` is called. */
  write(chunk: string | Uint8Array): boolean {
    if (this.finished) throw new Error('write after end');
    this.chunks.push(chunk);
    return true;
  }

  /** Ends the response. A second call is ignored (Node would raise write-after-end). */
  end(chunk?: string | Uint8Array | null, _encoding?: string): this {
    if (this.finished) return this;
    if (chunk !== undefined && chunk !== null) this.chunks.push(chunk);
    this.finished = true;
    this.writableEnded = true;
    this.headersSent = true;
    this.settle({ status: this.statusCode, headers: this.getHeaders(), body: this.joinedBody() });
    this.emit('finish');
    this.emit('close');
    return this;
  }

  private joinedBody(): string | Uint8Array | null {
    if (this.chunks.length === 0) return null;
    if (this.chunks.length === 1) return this.chunks[0];
    if (this.chunks.every((c) => typeof c === 'string')) return (this.chunks as string[]).join('');
    const parts = this.chunks.map((c) => (typeof c === 'string' ? encoder.encode(c) : c));
    const out = new Uint8Array(parts.reduce((sum, p) => sum + p.byteLength, 0));
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.byteLength;
    }
    return out;
  }

  // Events (what the server may listen to: 'finish' / 'close') --------------

  on(event: string, listener: Listener): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  once(event: string, listener: Listener): this {
    const wrapped: Listener = (...args) => {
      this.removeListener(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  removeListener(event: string, listener: Listener): this {
    const list = this.listeners.get(event);
    if (list) this.listeners.set(event, list.filter((l) => l !== listener));
    return this;
  }

  off(event: string, listener: Listener): this {
    return this.removeListener(event, listener);
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this.listeners.get(event);
    if (!list || list.length === 0) return false;
    for (const listener of [...list]) listener(...args);
    return true;
  }

  // Not available in a worker -----------------------------------------------

  sendFile(): never {
    throw new Error('res.sendFile() is not available in the mobile core (no static files are served there)');
  }

  redirect(): never {
    throw new Error('res.redirect() is not available in the mobile core');
  }
}
