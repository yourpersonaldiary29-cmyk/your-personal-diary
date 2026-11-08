/**
 * The `express` of the Android core: the subset of Express 5 that server/src/app.ts, the routers
 * in server/src/routes/*.ts and the middleware in server/src/middleware/*.ts use, without
 * node:http. The alias plugin (mobile/core/alias-plugin.ts) resolves every `import ... from
 * 'express'` of a server module to this file (`modules: { express: <this file> }` in
 * mobile/vite.config.mobile.ts and mobile/vitest.config.ts); mobile/core/app.ts imports it
 * directly to compose the app.
 *
 * Inventory (grep of server/src outside the Node-only modules):
 *   express()            app.use / get / set / disable; the app as a request handler
 *   express.json(opts)   one parser per route group, each with its own limit (body.ts)
 *   express.static       the desktop serves the UI from disk; the phone never does - the
 *                        middleware here just passes the request on
 *   Router()             use / get / post / put / patch / delete / all, mounting with prefixes
 *   req                  params, query, body, headers, header() / get(), ip, socket.remoteAddress,
 *                        method, path, baseUrl, originalUrl, isLocal / locale / auth (set by the
 *                        server middleware)
 *   res                  status, json, send, setHeader / set, type, end, sendStatus, attachment
 *   next(err)            four-argument error middleware, rejected promises of async handlers
 *
 * What is NOT here (and not needed by the core): views, cookies, redirects, sendFile, sessions,
 * `app.listen` (the host posts requests over postMessage - see ./dispatch.ts).
 */
import { json, raw, text, type BodyParser, type JsonOptions, type RawOptions, type TextOptions } from './body';
import type { NextFunction, Request, Response } from './http';
import { createApplication, Router, type AnyHandler, type Application, type PathSpec, type Route, type RouterInstance } from './router';

export { json, raw, text, Router, createApplication };
export { dispatch, bodyJson, bodyText, type DispatchInit, type DispatchResult } from './dispatch';
export { Request, Response, LOOPBACK_ADDRESS, type RequestInit, type ResponseResult } from './http';
export { parseQuery, type ParsedQuery } from './query';
export { bodyError, parseLimit, type BodyError } from './body';
export type { AnyHandler, Application, BodyParser, JsonOptions, NextFunction, PathSpec, RawOptions, Route, RouterInstance, TextOptions };

/** Express's `Express` type: the application. */
export type Express = Application;
export type RequestHandler = (req: Request, res: Response, next: NextFunction) => unknown;
export type ErrorRequestHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => unknown;

export interface StaticOptions {
  index?: string | false;
  fallthrough?: boolean;
  maxAge?: number | string;
}

/**
 * `express.static(root)`: on the desktop it serves the built UI to phones on the home network.
 * The mobile core serves no files (the WebView loads the UI from the app's own assets), so this
 * middleware lets every request through to the next handler (`fallthrough`).
 */
function serveStatic(_root: string, _options: StaticOptions = {}): BodyParser {
  return function staticNotServed(_req, _res, next) {
    next();
  };
}

/** `express.urlencoded()`: no route of the API reads form bodies; the parser steps aside. */
function urlencoded(): BodyParser {
  return function urlencodedNotParsed(_req, _res, next) {
    next();
  };
}

export interface ExpressFactory {
  (): Application;
  json: typeof json;
  raw: typeof raw;
  text: typeof text;
  urlencoded: typeof urlencoded;
  static: typeof serveStatic;
  Router: typeof Router;
  application: Application | undefined;
}

const express = Object.assign(function express(): Application {
  return createApplication();
}, {
  json,
  raw,
  text,
  urlencoded,
  static: serveStatic,
  Router,
  application: undefined,
}) as ExpressFactory;

export { serveStatic as static, urlencoded };
export default express;
