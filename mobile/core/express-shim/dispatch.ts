/**
 * Runs one request through an application of the express shim and resolves with what an HTTP
 * client would have received: status, headers (lower-case names) and the body as text or bytes.
 *
 * Used by the mobile core for every `CoreRequest` of the host (mobile/core/boot.ts) and by the
 * contract tests, which compare the result with the desktop server's HTTP answer.
 */
import { Request, Response, type RequestInit, type ResponseResult } from './http';
import { defaultFinalHandler, type Application } from './router';

export type DispatchInit = RequestInit;
export type DispatchResult = ResponseResult;

/** Dispatches `init` through `app`. Never rejects: whatever happens, the response is the answer. */
export function dispatch(app: Application, init: DispatchInit): Promise<DispatchResult> {
  const req = new Request(init);
  const res = new Response();
  const result = res.done;
  const final = defaultFinalHandler(req, res);
  try {
    app.handle(req, res, final);
  } catch (error) {
    final(error);
  }
  return result;
}

const decoder = new TextDecoder('utf-8');

/** The body of a result as text (bytes decoded as UTF-8; '' when there is none). */
export function bodyText(result: DispatchResult): string {
  if (result.body === null) return '';
  return typeof result.body === 'string' ? result.body : decoder.decode(result.body);
}

/** The body of a result parsed as JSON (undefined when empty). */
export function bodyJson<T = unknown>(result: DispatchResult): T | undefined {
  const text = bodyText(result);
  return text === '' ? undefined : (JSON.parse(text) as T);
}
