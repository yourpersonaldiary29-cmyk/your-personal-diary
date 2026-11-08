// @vitest-environment node
/**
 * The express shim (mobile/core/express-shim) on its own: routing, mounting, params, query
 * parsing, body parsing, error flow and the response helpers - the Express 5 rules the server
 * code relies on. The end-to-end proof that the whole API answers like the desktop is
 * mobile/test/core/contract.test.ts.
 */
import { describe, expect, it } from 'vitest';
import express, { bodyJson, bodyText, dispatch, parseQuery, Router, type NextFunction, type Request, type Response } from '../../core/express-shim';

type Res = Awaited<ReturnType<typeof dispatch>>;

function call(app: ReturnType<typeof express>, method: string, url: string, init: { headers?: Record<string, string>; body?: string | Uint8Array } = {}): Promise<Res> {
  return dispatch(app, { method, url, headers: init.headers, body: init.body });
}

const jsonHeaders = { 'content-type': 'application/json' };

describe('express shim: routing', () => {
  it('matches routes by method and whole path, case-insensitively, with an optional trailing slash', async () => {
    const app = express();
    app.get('/api/health', (_req: Request, res: Response) => res.json({ ok: true }));
    app.post('/api/health', (_req: Request, res: Response) => res.status(201).json({ created: true }));
    expect(bodyJson(await call(app, 'GET', '/api/health'))).toEqual({ ok: true });
    expect(bodyJson(await call(app, 'GET', '/api/health/'))).toEqual({ ok: true });
    expect(bodyJson(await call(app, 'GET', '/API/Health'))).toEqual({ ok: true });
    expect((await call(app, 'POST', '/api/health')).status).toBe(201);
    expect((await call(app, 'GET', '/api/healthy')).status).toBe(404);
    expect((await call(app, 'GET', '/api/health/x')).status).toBe(404);
    expect((await call(app, 'PUT', '/api/health')).status).toBe(404);
    // HEAD is answered by the GET route, without a body.
    const head = await call(app, 'HEAD', '/api/health');
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
  });

  it('mounts routers with a prefix: baseUrl, path and url are relative while they run and restored after', async () => {
    const seen: string[] = [];
    const app = express();
    const r = Router();
    r.use((req: Request, _res: Response, next: NextFunction) => {
      seen.push(`router ${req.baseUrl} ${req.path} ${req.url}`);
      next();
    });
    r.get('/:id/logs/:date', (req: Request, res: Response) => {
      seen.push(`route ${req.baseUrl}${req.path}`);
      res.json(req.params);
    });
    app.use('/api/habits', r);
    app.use((req: Request, res: Response) => {
      seen.push(`after ${req.baseUrl} ${req.path}`);
      res.status(404).end();
    });

    const hit = await call(app, 'GET', '/api/habits/12/logs/2026-09-30?from=a');
    expect(bodyJson(hit)).toEqual({ id: '12', date: '2026-09-30' });
    expect(seen).toEqual(['router /api/habits /12/logs/2026-09-30 /12/logs/2026-09-30?from=a', 'route /api/habits/12/logs/2026-09-30']);

    seen.length = 0;
    expect((await call(app, 'GET', '/api/habits')).status).toBe(404);
    // The mount point itself: path '/' inside the router; the url is restored on the way out.
    expect(seen).toEqual(['router /api/habits / /', 'after  /api/habits']);

    seen.length = 0;
    expect((await call(app, 'GET', '/api/habitsx/1')).status).toBe(404);
    expect(seen).toEqual(['after  /api/habitsx/1']);
  });

  it('runs middleware in order, route-level handlers included; a router fixed path beats a later :id route', async () => {
    const order: string[] = [];
    const app = express();
    const r = Router();
    r.get('/progress', (_req: Request, res: Response) => res.json('progress'));
    r.get('/:id', (req: Request, res: Response) => res.json(`id ${req.params.id}`));
    app.use(
      (_req: Request, _res: Response, next: NextFunction) => {
        order.push('a');
        next();
      },
      (_req: Request, _res: Response, next: NextFunction) => {
        order.push('b');
        next();
      },
    );
    app.use('/x', r);
    expect(bodyJson(await call(app, 'GET', '/x/progress'))).toBe('progress');
    expect(bodyJson(await call(app, 'GET', '/x/42'))).toBe('id 42');
    expect(order).toEqual(['a', 'b', 'a', 'b']);
  });

  it('decodes params and matches RegExp paths', async () => {
    const app = express();
    app.get('/entries/day/:date', (req: Request, res: Response) => res.json(req.params.date));
    app.get('/tags/:tag', (req: Request, res: Response) => res.json(req.params.tag));
    app.all(/^\/legacy(\/.*)?$/, (req: Request, res: Response) => res.json(req.params));
    expect(bodyJson(await call(app, 'GET', '/entries/day/2026-10-03'))).toBe('2026-10-03');
    expect(bodyJson(await call(app, 'GET', '/tags/%D7%A2%D7%91%D7%95%D7%93%D7%94'))).toBe('עבודה');
    expect(bodyJson(await call(app, 'DELETE', '/legacy/a/b'))).toEqual({ '0': '/a/b' });
    expect(bodyJson(await call(app, 'GET', '/legacy'))).toEqual({});
  });

  it('refuses path syntax the server does not use instead of guessing', () => {
    const app = express();
    expect(() => app.get('/files/*', () => undefined)).toThrow(/Unsupported path syntax/);
    expect(() => app.get('/a/(b)', () => undefined)).toThrow(/Unsupported path syntax/);
  });
});

describe('express shim: errors', () => {
  it('next(err), a thrown error and a rejected promise all reach the 4-argument handler, skipping normal handlers', async () => {
    const app = express();
    app.get('/next', (_req: Request, _res: Response, next: NextFunction) => next(new Error('via next')));
    app.get('/throw', () => {
      throw new Error('thrown');
    });
    app.get('/reject', async () => {
      throw new Error('rejected');
    });
    app.use((_req: Request, res: Response) => res.status(200).json('should not run'));
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).json({ message: (err as Error).message });
    });
    expect(bodyJson(await call(app, 'GET', '/next'))).toEqual({ message: 'via next' });
    expect(bodyJson(await call(app, 'GET', '/throw'))).toEqual({ message: 'thrown' });
    expect(bodyJson(await call(app, 'GET', '/reject'))).toEqual({ message: 'rejected' });
  });

  it('routes never match while an error is pending; error handlers are skipped without one', async () => {
    const app = express();
    const calls: string[] = [];
    app.use('/x', (_req: Request, _res: Response, next: NextFunction) => next(new Error('boom')));
    app.get('/x', (_req: Request, res: Response) => {
      calls.push('route');
      res.json('route');
    });
    app.use((_err: unknown, _req: Request, _res: Response, next: NextFunction) => {
      calls.push('error handler');
      next();
    });
    app.use((_req: Request, res: Response) => {
      calls.push('tail');
      res.json('tail');
    });
    expect(bodyJson(await call(app, 'GET', '/x'))).toBe('tail');
    expect(calls).toEqual(['error handler', 'tail']);
    calls.length = 0;
    expect(bodyJson(await call(app, 'GET', '/y'))).toBe('tail');
    expect(calls).toEqual(['tail']);
  });

  it('without any handler: 404 "Cannot GET", and an unhandled error is a plain 500 (status honoured when 4xx)', async () => {
    const app = express();
    app.get('/fail', () => {
      throw Object.assign(new Error('nope'), { status: 418 });
    });
    app.get('/crash', () => {
      throw new Error('secret details');
    });
    const missing = await call(app, 'GET', '/nothing?x=1');
    expect(missing.status).toBe(404);
    expect(bodyText(missing)).toBe('Cannot GET /nothing');
    expect(missing.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect((await call(app, 'GET', '/fail')).status).toBe(418);
    const crash = await call(app, 'GET', '/crash');
    expect(crash.status).toBe(500);
    expect(bodyText(crash)).not.toContain('secret');
  });

  it('a long chain of synchronous next() calls does not overflow the stack', async () => {
    const app = express();
    for (let i = 0; i < 5000; i++) app.use((_req: Request, _res: Response, next: NextFunction) => next());
    app.use((_req: Request, res: Response) => res.json('end'));
    expect(bodyJson(await call(app, 'GET', '/'))).toBe('end');
  });
});

describe('express shim: request', () => {
  it('query: node:querystring rules (repeats -> arrays, +, percent-decoding, malformed kept, null prototype)', () => {
    const q = parseQuery('a=1&&b=2&a=3&c&d=&e=x+y%20z&f=%E2%9C%93&g=%ZZ%41&=v&h=1=2&constructor=x');
    expect({ ...q }).toEqual({ a: ['1', '3'], b: '2', c: '', d: '', e: 'x y z', f: '✓', g: '%ZZA', '': 'v', h: '1=2', constructor: 'x' });
    expect(Object.getPrototypeOf(q)).toBeNull();
    expect({ ...parseQuery('') }).toEqual({});
  });

  it('headers are lower-cased; header()/get() are case-insensitive; ip and socket are loopback', async () => {
    const app = express();
    app.get('/', (req: Request, res: Response) => {
      res.json({
        auth: req.header('Authorization'),
        lang: req.get('ACCEPT-LANGUAGE'),
        missing: req.header('x-none') ?? null,
        ip: req.ip,
        remote: req.socket.remoteAddress,
        encrypted: req.socket.encrypted,
        method: req.method,
        originalUrl: req.originalUrl,
        query: req.query,
      });
    });
    const res = await call(app, 'get', '/?limit=5&tag=a', { headers: { Authorization: 'Bearer t', 'Accept-Language': 'he' } });
    expect(bodyJson(res)).toEqual({
      auth: 'Bearer t',
      lang: 'he',
      missing: null,
      ip: '127.0.0.1',
      remote: '127.0.0.1',
      encrypted: false,
      method: 'GET',
      originalUrl: '/?limit=5&tag=a',
      query: { limit: '5', tag: 'a' },
    });
  });
});

describe('express shim: express.json()', () => {
  function echoApp(limit?: string) {
    const app = express();
    app.use('/small', express.json({ limit: limit ?? '100kb' }), (req: Request, res: Response) => res.json({ body: req.body ?? null, parsed: req.body !== undefined }));
    app.use((err: { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.status ?? 500).json({ type: err.type ?? 'other' });
    });
    return app;
  }

  it('parses a JSON object or array; a body of another type or no body leaves req.body undefined', async () => {
    const app = echoApp();
    expect(bodyJson(await call(app, 'POST', '/small', { headers: jsonHeaders, body: '{"a":1}' }))).toEqual({ body: { a: 1 }, parsed: true });
    expect(bodyJson(await call(app, 'POST', '/small', { headers: { 'content-type': 'application/json; charset=utf-8' }, body: '[1,2]' }))).toEqual({ body: [1, 2], parsed: true });
    expect(bodyJson(await call(app, 'POST', '/small', { headers: { 'content-type': 'text/plain' }, body: '{"a":1}' }))).toEqual({ body: null, parsed: false });
    expect(bodyJson(await call(app, 'POST', '/small', { headers: jsonHeaders }))).toEqual({ body: null, parsed: false });
    expect(bodyJson(await call(app, 'POST', '/small', { headers: jsonHeaders, body: '' }))).toEqual({ body: null, parsed: false });
    // Bytes are decoded as UTF-8.
    const bytes = new TextEncoder().encode('{"he":"שלום"}');
    expect(bodyJson(await call(app, 'POST', '/small', { headers: jsonHeaders, body: bytes }))).toEqual({ body: { he: 'שלום' }, parsed: true });
  });

  it("parses 'application/json' only, like Express: a '+json' media type is left alone unless the caller asks for it", async () => {
    const app = echoApp();
    const unparsed = { body: null, parsed: false };
    expect(bodyJson(await call(app, 'POST', '/small', { headers: { 'content-type': 'application/vnd.api+json' }, body: '{"a":1}' }))).toEqual(unparsed);
    expect(bodyJson(await call(app, 'POST', '/small', { headers: { 'content-type': 'application/problem+json; charset=utf-8' }, body: '{"a":1}' }))).toEqual(unparsed);
    expect(bodyJson(await call(app, 'POST', '/small', { headers: { 'content-type': 'text/json' }, body: '{"a":1}' }))).toEqual(unparsed);
    // Case and parameters of the header do not matter.
    expect(bodyJson(await call(app, 'POST', '/small', { headers: { 'content-type': 'Application/JSON; charset=UTF-8' }, body: '{"a":1}' }))).toEqual({ body: { a: 1 }, parsed: true });

    const wide = express();
    wide.use('/any', express.json({ type: ['application/json', '+json'] }), (req: Request, res: Response) => res.json({ body: req.body ?? null, parsed: req.body !== undefined }));
    expect(bodyJson(await call(wide, 'POST', '/any', { headers: { 'content-type': 'application/vnd.api+json' }, body: '{"a":1}' }))).toEqual({ body: { a: 1 }, parsed: true });
    expect(bodyJson(await call(wide, 'POST', '/any', { headers: jsonHeaders, body: '{"a":2}' }))).toEqual({ body: { a: 2 }, parsed: true });
    expect(bodyJson(await call(wide, 'POST', '/any', { headers: { 'content-type': 'text/plain' }, body: '{"a":1}' }))).toEqual(unparsed);
  });

  it('a byte order mark before the JSON is not part of it - in a text body and in a bytes body (body-parser decodes it away)', async () => {
    const app = echoApp();
    const BOM = '\uFEFF';
    expect(bodyJson(await call(app, 'POST', '/small', { headers: jsonHeaders, body: `${BOM}{"a":1}` }))).toEqual({ body: { a: 1 }, parsed: true });
    expect(bodyJson(await call(app, 'POST', '/small', { headers: jsonHeaders, body: `${BOM} \n[1,2]` }))).toEqual({ body: [1, 2], parsed: true });
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('{"he":"שלום"}')]);
    expect(bodyJson(await call(app, 'POST', '/small', { headers: jsonHeaders, body: bytes }))).toEqual({ body: { he: 'שלום' }, parsed: true });
    // A body that is nothing but the mark is an empty JSON body.
    expect(bodyJson(await call(app, 'POST', '/small', { headers: jsonHeaders, body: BOM }))).toEqual({ body: {}, parsed: true });
    // Only one is dropped, and what follows still has to be an object or an array.
    const twice = await call(app, 'POST', '/small', { headers: jsonHeaders, body: `${BOM}${BOM}{"a":1}` });
    expect([twice.status, bodyJson(twice)]).toEqual([400, { type: 'entity.parse.failed' }]);
    const scalar = await call(app, 'POST', '/small', { headers: jsonHeaders, body: `${BOM}"text"` });
    expect([scalar.status, bodyJson(scalar)]).toEqual([400, { type: 'entity.parse.failed' }]);
    // A mark in the middle is content.
    expect(bodyJson(await call(app, 'POST', '/small', { headers: jsonHeaders, body: `{"a":"${BOM}x"}` }))).toEqual({ body: { a: `${BOM}x` }, parsed: true });

    // express.text() drops it too; express.raw() keeps the bytes as they are.
    const other = express();
    other.use('/text', express.text(), (req: Request, res: Response) => res.json({ body: req.body }));
    other.use('/raw', express.raw(), (req: Request, res: Response) => res.json({ length: (req.body as Uint8Array).length }));
    expect(bodyJson(await call(other, 'POST', '/text', { headers: { 'content-type': 'text/plain' }, body: `${BOM}hello` }))).toEqual({ body: 'hello' });
    expect(bodyJson(await call(other, 'POST', '/raw', { headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array([0xef, 0xbb, 0xbf, 0x41]) }))).toEqual({ length: 4 });
  });

  it('malformed or non-strict JSON -> 400 entity.parse.failed; over the limit -> 413 entity.too.large; other charset -> 415', async () => {
    const app = echoApp('1kb');
    const bad = await call(app, 'POST', '/small', { headers: jsonHeaders, body: '{"a":' });
    expect([bad.status, bodyJson(bad)]).toEqual([400, { type: 'entity.parse.failed' }]);
    const scalar = await call(app, 'POST', '/small', { headers: jsonHeaders, body: '"just a string"' });
    expect([scalar.status, bodyJson(scalar)]).toEqual([400, { type: 'entity.parse.failed' }]);
    const big = await call(app, 'POST', '/small', { headers: jsonHeaders, body: JSON.stringify({ text: 'x'.repeat(2000) }) });
    expect([big.status, bodyJson(big)]).toEqual([413, { type: 'entity.too.large' }]);
    // 1kb is 1024 bytes, counted in UTF-8 bytes.
    const fits = await call(app, 'POST', '/small', { headers: jsonHeaders, body: JSON.stringify({ t: 'x'.repeat(1010) }) });
    expect(fits.status).toBe(200);
    const latin = await call(app, 'POST', '/small', { headers: { 'content-type': 'application/json; charset=iso-8859-1' }, body: '{}' });
    expect([latin.status, bodyJson(latin)]).toEqual([415, { type: 'charset.unsupported' }]);
  });
});

describe('express shim: response', () => {
  it('json / send / end / sendStatus / type / setHeader produce what Express produces', async () => {
    const app = express();
    app.get('/json', (_req: Request, res: Response) => res.status(201).json({ a: 'é' }));
    app.get('/text', (_req: Request, res: Response) => res.type('text/html; charset=utf-8').send('<p>x</p>'));
    app.get('/plain', (_req: Request, res: Response) => res.send('hello'));
    app.get('/bytes', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="a.pdf"');
      res.end(new Uint8Array([37, 80, 68, 70]));
    });
    app.get('/buffer', (_req: Request, res: Response) => res.send(new Uint8Array([1, 2, 3])));
    app.get('/empty', (_req: Request, res: Response) => res.status(204).end());
    app.get('/status', (_req: Request, res: Response) => res.sendStatus(423));
    app.get('/object', (_req: Request, res: Response) => res.send({ via: 'send' }));
    app.get('/attach', (_req: Request, res: Response) => res.attachment('יומן.csv').send('a,b'));

    const json = await call(app, 'GET', '/json');
    expect(json.status).toBe(201);
    expect(json.headers).toEqual({ 'content-type': 'application/json; charset=utf-8', 'content-length': '10' });
    expect(json.body).toBe('{"a":"é"}');

    const text = await call(app, 'GET', '/text');
    expect(text.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(text.body).toBe('<p>x</p>');
    expect((await call(app, 'GET', '/plain')).headers['content-type']).toBe('text/html; charset=utf-8');

    const bytes = await call(app, 'GET', '/bytes');
    expect(bytes.headers['content-type']).toBe('application/pdf');
    expect(Array.from(bytes.body as Uint8Array)).toEqual([37, 80, 68, 70]);
    const buffer = await call(app, 'GET', '/buffer');
    expect(buffer.headers).toEqual({ 'content-type': 'application/octet-stream', 'content-length': '3' });

    const empty = await call(app, 'GET', '/empty');
    expect(empty.status).toBe(204);
    expect(empty.body).toBeNull();
    expect(empty.headers).toEqual({});

    const status = await call(app, 'GET', '/status');
    expect([status.status, status.body, status.headers['content-type']]).toEqual([423, 'Locked', 'text/plain; charset=utf-8']);
    expect(bodyJson(await call(app, 'GET', '/object'))).toEqual({ via: 'send' });
    const attach = await call(app, 'GET', '/attach');
    expect(attach.headers['content-disposition']).toBe(`attachment; filename="____.csv"; filename*=UTF-8''${encodeURIComponent('יומן.csv')}`);
    expect(attach.headers['content-type']).toBe('text/csv; charset=utf-8');
  });

  it('app settings: set / get / disable; express.static passes through', async () => {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', false);
    expect(app.get('x-powered-by')).toBe(false);
    expect(app.enabled('x-powered-by')).toBe(false);
    expect(app.get('trust proxy')).toBe(false);
    app.use(express.static('/nowhere', { index: 'index.html', fallthrough: true, maxAge: 0 }));
    app.get('/', (_req: Request, res: Response) => res.json('after static'));
    expect(bodyJson(await call(app, 'GET', '/'))).toBe('after static');
  });
});
