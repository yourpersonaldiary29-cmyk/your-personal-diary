/**
 * Staging-only routes of hosted mode (docs/HOSTED-PLAN.md 2.2, 3.8), mounted at /api/debug only
 * while `DIARY_DEBUG_ROUTES=1`; a test asserts they are 404 otherwise. They read headers and exit -
 * no crypto, no disk, no network.
 *
 *   GET  /api/debug/proxy   what the proxy plumbing sees: the selected client address, the whole
 *                           forwarded chain, the raw X-Forwarded-* headers, `secure` and the Host.
 *                           WP-H4 establishes the hop count with it from two networks.
 *   POST /api/debug/crash   answers 202 and exits with code 2: proves the platform restarts us.
 */
import { Router, type Request, type Response } from 'express';
import { clientIp, isSecureRequest, lastForwardedProto, limiterKey } from '../middleware/access';

function headerText(req: Request, name: string): string {
  const raw = req.headers[name];
  return Array.isArray(raw) ? raw.join(', ') : (raw ?? '');
}

export function debugRouter(exit: (code: number) => void = (code) => process.exit(code)): Router {
  const r = Router();
  r.get('/proxy', (req: Request, res: Response) => {
    res.json({
      ip: clientIp(req),
      bucket: limiterKey(clientIp(req)),
      expressIp: req.ip ?? '',
      ips: req.ips ?? [],
      remoteAddress: req.socket.remoteAddress ?? '',
      xff: headerText(req, 'x-forwarded-for'),
      xfp: headerText(req, 'x-forwarded-proto'),
      lastProto: lastForwardedProto(req),
      secure: isSecureRequest(req),
      host: headerText(req, 'host'),
    });
  });
  r.post('/crash', (_req: Request, res: Response) => {
    res.status(202).json({ ok: true, exiting: 2 });
    setTimeout(() => exit(2), 50).unref?.();
  });
  return r;
}
