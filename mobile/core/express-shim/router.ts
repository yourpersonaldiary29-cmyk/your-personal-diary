/**
 * Routing of the express shim: `Router()`, `express()`, path matching, mounting with prefixes
 * and the error-handling chain - the part of Express 5 (router 2.x) that server/src uses, with
 * the same observable rules:
 *
 *  - `use([path], ...fns)` matches a prefix ('/api/auth' matches '/api/auth' and '/api/auth/x',
 *    not '/api/authx'), strips it from `req.url` while the handlers run and sets `req.baseUrl`
 *    to the mounted path (without a trailing slash); both are restored when the handlers call
 *    `next()` out of the layer. `use()` without a path matches everything;
 *  - `get/post/put/patch/delete/all(path, ...fns)` matches the whole path, case-insensitively,
 *    with an optional trailing slash; `:name` segments become decoded `req.params`; a RegExp path
 *    is tested as given (numbered groups become params);
 *  - a handler with four parameters is an error handler: it runs only when a previous handler
 *    called `next(err)` or threw; normal handlers are skipped while an error is pending, and
 *    routes never match with a pending error;
 *  - a handler that returns a rejecting promise forwards the rejection to `next()` (Express 5);
 *    a resolving promise is not awaited and does not call `next()`;
 *  - HEAD falls back to GET; `next('route')` leaves the current route;
 *  - after 100 synchronous nested `next()` calls the chain continues asynchronously (as Express
 *    does with setImmediate) so a long stack cannot overflow.
 *
 * Handlers are typed loosely (`AnyHandler`): the real ones are the routers of server/src, typed
 * against @types/express, which the mobile build never sees.
 */
import type { NextFunction, Request, Response } from './http';

/** Any Express-style handler: (req, res, next) or (err, req, res, next); a Router is one too. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyHandler = (...args: any[]) => unknown;

export type PathSpec = string | RegExp | Array<string | RegExp>;

/** HTTP methods routes can be registered for (Express exposes many more; these cover the API). */
export const ROUTE_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;
export type RouteMethod = (typeof ROUTE_METHODS)[number];

interface MatchResult {
  /** The matched part of the path (the mount prefix of a `use` layer). */
  path: string;
  params: Record<string, string>;
}

type Matcher = (path: string) => MatchResult | null;

/** A thrown error of `decodeURIComponent` on a path parameter: Express answers 400. */
function decodeParam(value: string): string {
  if (!value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    const error = new Error(`Failed to decode param '${value}'`) as Error & { status: number; statusCode: number };
    error.status = 400;
    error.statusCode = 400;
    throw error;
  }
}

const PARAM_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*/;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * A string path -> matcher. Literal text and `:name` segments; the characters of path-to-regexp
 * syntax that the server does not use ('*', '(', ')', '{', '}', '?', '+') are refused so that a
 * route that depends on them cannot silently match differently from the desktop.
 */
export function compilePath(pattern: string, end: boolean): Matcher {
  if (typeof pattern !== 'string') throw new TypeError('A route path must be a string, a RegExp or an array of them');
  if (!end && pattern === '/') return () => ({ path: '', params: {} });
  const keys: string[] = [];
  let source = '';
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];
    if (char === ':') {
      const name = PARAM_NAME.exec(pattern.slice(i + 1))?.[0];
      if (!name) throw new TypeError(`Missing parameter name at ${i}: ${pattern}`);
      keys.push(name);
      source += '([^\\/]+?)';
      i += 1 + name.length;
      continue;
    }
    if ('*(){}?+'.includes(char)) throw new TypeError(`Unsupported path syntax '${char}' in route "${pattern}" (the express shim supports literals and :params)`);
    source += escapeRegExp(char);
    i += 1;
  }
  // Optional trailing slash (strict: false); a prefix must end at a segment boundary.
  const regexp = new RegExp(`^${source}${end ? '\\/?$' : '(?=\\/|$)'}`, 'i');
  return (path) => {
    const match = regexp.exec(path);
    if (!match) return null;
    const params: Record<string, string> = {};
    keys.forEach((key, index) => {
      params[key] = decodeParam(match[index + 1]);
    });
    return { path: match[0], params };
  };
}

function compileRegExp(pattern: RegExp): Matcher {
  return (path) => {
    const match = pattern.exec(path);
    if (!match) return null;
    const params: Record<string, string> = {};
    for (let i = 1; i < match.length; i++) if (match[i] !== undefined) params[String(i - 1)] = match[i];
    return { path: match[0], params };
  };
}

function compile(path: PathSpec, end: boolean): Matcher[] {
  const list = Array.isArray(path) ? path : [path];
  return list.map((p) => (p instanceof RegExp ? compileRegExp(p) : compilePath(p, end)));
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

/** Runs `fn` and routes a thrown error or a rejected promise to `next` (router 2.x Layer). */
function invoke(fn: AnyHandler, args: unknown[], next: NextFunction): void {
  try {
    const result = fn(...args);
    if (isPromiseLike(result)) {
      result.then(undefined, (error: unknown) => next(error ?? new Error('Rejected promise')));
    }
  } catch (error) {
    next(error);
  }
}

/** Continues `fn` in a later task (the shim's setImmediate). */
function defer(fn: () => void): void {
  setTimeout(fn, 0);
}

/** How deep `next()` may recurse synchronously before the chain is continued asynchronously. */
const MAX_SYNC_DEPTH = 100;

class Layer {
  readonly handle: AnyHandler;
  readonly matchers: Matcher[];
  /** Set for the layers `route()` creates. */
  route: Route | null = null;
  /** Filled by the last successful `match()`. */
  path = '';
  params: Record<string, string> = {};

  constructor(path: PathSpec, end: boolean, handle: AnyHandler) {
    if (typeof handle !== 'function') throw new TypeError(`Router.use() requires a middleware function but got a ${handle === null ? 'null' : typeof handle}`);
    this.handle = handle;
    this.matchers = compile(path, end);
  }

  /** True when the layer matches `path` (then `this.path` / `this.params` are set); an Error when a param cannot be decoded. */
  match(path: string): boolean | Error {
    for (const matcher of this.matchers) {
      try {
        const found = matcher(path);
        if (found) {
          this.path = found.path;
          this.params = found.params;
          return true;
        }
      } catch (error) {
        return error as Error;
      }
    }
    this.path = '';
    this.params = {};
    return false;
  }

  handleRequest(req: Request, res: Response, next: NextFunction): void {
    if (this.handle.length > 3) return next();
    invoke(this.handle, [req, res, next], next);
  }

  handleError(error: unknown, req: Request, res: Response, next: NextFunction): void {
    if (this.handle.length !== 4) return next(error);
    invoke(this.handle, [error, req, res, next], next);
  }
}

interface RouteLayer {
  /** Lower-case method, or null for `all`. */
  method: string | null;
  handle: AnyHandler;
}

/** One path with handlers per method (`router.route(path)`, what `router.get(path, ...)` creates). */
export class Route {
  readonly stack: RouteLayer[] = [];
  private readonly methods = new Set<string>();

  constructor(readonly path: PathSpec) {}

  handlesMethod(method: string): boolean {
    if (this.methods.has('_all')) return true;
    let name = method.toLowerCase();
    if (name === 'head' && !this.methods.has('head')) name = 'get';
    return this.methods.has(name);
  }

  allowedMethods(): string[] {
    const list = [...this.methods].filter((m) => m !== '_all').map((m) => m.toUpperCase());
    if (list.includes('GET') && !list.includes('HEAD')) list.push('HEAD');
    return list;
  }

  private add(method: string | null, handlers: AnyHandler[]): this {
    for (const handle of handlers.flat() as AnyHandler[]) {
      if (typeof handle !== 'function') throw new TypeError(`Route.${method ?? 'all'}() requires a callback function but got a ${typeof handle}`);
      this.stack.push({ method, handle });
    }
    this.methods.add(method ?? '_all');
    return this;
  }

  all(...handlers: AnyHandler[]): this {
    return this.add(null, handlers);
  }

  get(...handlers: AnyHandler[]): this {
    return this.add('get', handlers);
  }

  post(...handlers: AnyHandler[]): this {
    return this.add('post', handlers);
  }

  put(...handlers: AnyHandler[]): this {
    return this.add('put', handlers);
  }

  patch(...handlers: AnyHandler[]): this {
    return this.add('patch', handlers);
  }

  delete(...handlers: AnyHandler[]): this {
    return this.add('delete', handlers);
  }

  head(...handlers: AnyHandler[]): this {
    return this.add('head', handlers);
  }

  options(...handlers: AnyHandler[]): this {
    return this.add('options', handlers);
  }

  /** Runs the handlers of the request's method in order (the handle of the route's layer). */
  dispatch(req: Request, res: Response, done: NextFunction): void {
    const stack = this.stack;
    if (stack.length === 0) return done();
    let method = req.method.toLowerCase();
    if (method === 'head' && !this.methods.has('head')) method = 'get';
    req.route = this;
    let index = 0;
    let depth = 0;
    const next: NextFunction = (error?: unknown) => {
      if (error === 'route') return done();
      if (error === 'router') return done(error);
      if (++depth > MAX_SYNC_DEPTH) return defer(() => next(error));
      const layer = stack[index++];
      if (!layer) return done(error);
      if (layer.method !== null && layer.method !== method) {
        next(error);
      } else if (error !== undefined && error !== null) {
        if (layer.handle.length !== 4) next(error);
        else invoke(layer.handle, [error, req, res, next], next);
      } else if (layer.handle.length > 3) {
        next();
      } else {
        invoke(layer.handle, [req, res, next], next);
      }
      depth = 0;
    };
    next();
  }
}

/** The methods a router and an application share. */
export interface RouterMethods {
  use(...handlers: AnyHandler[]): this;
  use(path: PathSpec, ...handlers: AnyHandler[]): this;
  all(path: PathSpec, ...handlers: AnyHandler[]): this;
  get(path: PathSpec, ...handlers: AnyHandler[]): this;
  post(path: PathSpec, ...handlers: AnyHandler[]): this;
  put(path: PathSpec, ...handlers: AnyHandler[]): this;
  patch(path: PathSpec, ...handlers: AnyHandler[]): this;
  delete(path: PathSpec, ...handlers: AnyHandler[]): this;
  head(path: PathSpec, ...handlers: AnyHandler[]): this;
  options(path: PathSpec, ...handlers: AnyHandler[]): this;
  route(path: PathSpec): Route;
  /** Runs the request through the stack; `done` is called when nothing answered (with the pending error, if any). */
  handle(req: Request, res: Response, done: NextFunction): void;
}

/** A router: callable as a handler (so it can be mounted) and configurable like Express's. */
export interface RouterInstance extends RouterMethods {
  (req: Request, res: Response, next: NextFunction): void;
  readonly stack: readonly Layer[];
}

class RouterCore {
  readonly stack: Layer[] = [];

  use(...args: unknown[]): void {
    let path: PathSpec = '/';
    let handlers = args;
    const first = args[0];
    if (typeof first !== 'function' && !(Array.isArray(first) && first.every((h) => typeof h === 'function'))) {
      path = first as PathSpec;
      handlers = args.slice(1);
    }
    const flat = handlers.flat() as AnyHandler[];
    if (flat.length === 0) throw new TypeError('Router.use() requires a middleware function');
    for (const handle of flat) this.stack.push(new Layer(path, false, handle));
  }

  route(path: PathSpec): Route {
    const route = new Route(path);
    const layer = new Layer(path, true, (req: Request, res: Response, next: NextFunction) => route.dispatch(req, res, next));
    layer.route = route;
    this.stack.push(layer);
    return route;
  }

  /** The router loop of router 2.x (see the file comment). */
  handle(req: Request, res: Response, out: NextFunction): void {
    const stack = this.stack;
    const parentParams = req.params;
    const parentUrl = req.baseUrl || '';
    const parentNext = req.next;
    let index = 0;
    let removed = '';
    let slashAdded = false;
    let depth = 0;

    const done: NextFunction = (error?: unknown) => {
      req.baseUrl = parentUrl;
      req.params = parentParams;
      req.next = parentNext;
      out(error);
    };

    req.baseUrl = parentUrl;

    const next: NextFunction = (error?: unknown) => {
      let layerError: unknown = error === 'route' ? null : error;

      if (slashAdded) {
        req.url = req.url.slice(1);
        slashAdded = false;
      }
      if (removed.length !== 0) {
        req.baseUrl = parentUrl;
        req.url = removed + req.url;
        removed = '';
      }
      if (layerError === 'router') return defer(() => done(null));
      if (index >= stack.length) return defer(() => done(layerError));
      if (++depth > MAX_SYNC_DEPTH) return defer(() => next(error));

      const path = req.path;
      let layer: Layer | undefined;
      let match: boolean | Error = false;
      let route: Route | null = null;
      while (match !== true && index < stack.length) {
        layer = stack[index++];
        match = layer.match(path);
        route = layer.route;
        if (typeof match !== 'boolean') layerError = layerError ?? match;
        if (match !== true) continue;
        if (!route) continue;
        if (layerError !== undefined && layerError !== null) {
          // Routes do not match with a pending error.
          match = false;
          continue;
        }
        if (!route.handlesMethod(req.method) && req.method !== 'HEAD') match = false;
      }
      if (match !== true || !layer) return done(layerError);

      req.params = layer.params;
      req.next = next;
      const layerPath = layer.path;
      const pending = layerError !== undefined && layerError !== null;

      if (route) {
        layer.handleRequest(req, res, next);
      } else {
        if (layerPath.length !== 0) {
          // A `use` layer: trim the mount prefix (validated by the matcher) off the URL.
          removed = layerPath;
          req.url = req.url.slice(removed.length);
          if (req.url[0] !== '/') {
            req.url = `/${req.url}`;
            slashAdded = true;
          }
          req.baseUrl = parentUrl + (removed.endsWith('/') ? removed.slice(0, -1) : removed);
        }
        if (pending) layer.handleError(layerError, req, res, next);
        else layer.handleRequest(req, res, next);
      }
      depth = 0;
    };

    next();
  }
}

type Writable = Record<string, unknown>;

/** `Router()`: a mountable router (Express's `Router()` / `express.Router()`). */
export function Router(): RouterInstance {
  const core = new RouterCore();
  const router = function router(req: Request, res: Response, next: NextFunction): void {
    core.handle(req, res, next);
  } as unknown as RouterInstance;
  const target = router as unknown as Writable;
  Object.defineProperty(router, 'stack', { get: () => core.stack });
  target.use = (...args: unknown[]) => {
    core.use(...args);
    return router;
  };
  target.route = (path: PathSpec) => core.route(path);
  target.handle = (req: Request, res: Response, done: NextFunction) => core.handle(req, res, done);
  for (const method of ROUTE_METHODS) {
    target[method] = (path: PathSpec, ...handlers: AnyHandler[]) => {
      core.route(path)[method](...handlers);
      return router;
    };
  }
  target.all = (path: PathSpec, ...handlers: AnyHandler[]) => {
    core.route(path).all(...handlers);
    return router;
  };
  return router;
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

/** `express()`: the application - a router with settings; `app.handle` runs a request through it. */
export interface Application extends RouterMethods {
  (req: Request, res: Response, next?: NextFunction): void;
  readonly settings: Record<string, unknown>;
  readonly locals: Record<string, unknown>;
  readonly router: RouterInstance;
  /** `app.set(name, value)`; `app.set(name)` reads the setting. */
  set(name: string, value?: unknown): unknown;
  /** `app.get(name)` reads a setting; `app.get(path, ...handlers)` registers a route. */
  get(name: string): unknown;
  get(path: PathSpec, ...handlers: AnyHandler[]): this;
  enable(name: string): this;
  disable(name: string): this;
  enabled(name: string): boolean;
  disabled(name: string): boolean;
  /** Handles one request; `done` runs when nothing answered (the final handler of ./dispatch.ts otherwise). */
  handle(req: Request, res: Response, done?: NextFunction): void;
}

/** What `app.handle` does when the stack falls through and no `done` was given: a plain answer. */
export function defaultFinalHandler(req: Request, res: Response): NextFunction {
  return (error?: unknown) => {
    if (res.finished) return;
    if (error !== undefined && error !== null) {
      const candidate = error as { status?: unknown; statusCode?: unknown; message?: unknown };
      const raw = typeof candidate.status === 'number' ? candidate.status : typeof candidate.statusCode === 'number' ? candidate.statusCode : 500;
      const status = raw >= 400 && raw <= 599 ? raw : 500;
      if (status >= 500) console.error('[express-shim] unhandled error:', error);
      res.status(status).type('txt').send(status >= 500 || typeof candidate.message !== 'string' ? `Error ${status}` : candidate.message);
      return;
    }
    res.status(404).type('txt').send(`Cannot ${req.method} ${req.originalUrl.split('?')[0]}`);
  };
}

export function createApplication(): Application {
  const router = Router();
  const settings: Record<string, unknown> = { 'x-powered-by': true, etag: 'weak', env: 'production', 'query parser': 'simple' };
  const app = function app(req: Request, res: Response, next?: NextFunction): void {
    (app as unknown as Application).handle(req, res, next);
  } as unknown as Application;
  const target = app as unknown as Writable;

  Object.defineProperty(app, 'settings', { value: settings });
  Object.defineProperty(app, 'locals', { value: {} });
  Object.defineProperty(app, 'router', { value: router });

  target.handle = (req: Request, res: Response, done?: NextFunction) => {
    req.app = app;
    res.app = app;
    req.res = res;
    res.req = req;
    router.handle(req, res, done ?? defaultFinalHandler(req, res));
  };
  target.set = (...args: unknown[]) => {
    const name = String(args[0]);
    if (args.length === 1) return settings[name];
    settings[name] = args[1];
    return app;
  };
  target.enable = (name: string) => {
    settings[name] = true;
    return app;
  };
  target.disable = (name: string) => {
    settings[name] = false;
    return app;
  };
  target.enabled = (name: string) => Boolean(settings[name]);
  target.disabled = (name: string) => !settings[name];
  target.use = (...args: unknown[]) => {
    (router.use as (...a: unknown[]) => unknown)(...args);
    return app;
  };
  target.route = (path: PathSpec) => router.route(path);
  target.get = (path: PathSpec | string, ...handlers: AnyHandler[]) => {
    if (handlers.length === 0 && typeof path === 'string') return settings[path];
    router.get(path, ...handlers);
    return app;
  };
  for (const method of ROUTE_METHODS.filter((m) => m !== 'get')) {
    target[method] = (path: PathSpec, ...handlers: AnyHandler[]) => {
      router[method](path, ...handlers);
      return app;
    };
  }
  target.all = (path: PathSpec, ...handlers: AnyHandler[]) => {
    router.all(path, ...handlers);
    return app;
  };
  target.listen = () => {
    throw new Error('app.listen() is not available in the mobile core: requests arrive from the host over postMessage');
  };
  return app;
}
