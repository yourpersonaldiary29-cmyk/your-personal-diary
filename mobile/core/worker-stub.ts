/**
 * Placeholder diary core (WP-1): a Web Worker that speaks the host <-> core protocol
 * (mobile/shared/transport.ts) but has no server logic yet. It reports `ready` at once, answers
 * every API request with `503 { code: 'OTHER', message: 'core not ready' }` and acknowledges
 * every control message. The real core (mobile/core/worker.ts, WP-5) replaces it in
 * mobile/host/core-worker.ts.
 */
import {
  CORE_PROTOCOL_VERSION,
  isHostMessage,
  jsonResponse,
  type CoreMessage,
  type CoreReadyEvent,
  type HostMessage,
} from '../shared/transport';

/** The error body of every stubbed API answer (an `ApiErrorBody`). */
export const STUB_ERROR_BODY = { code: 'OTHER', message: 'core not ready' } as const;

/** The reply of the stub to one host message (null: nothing to say). */
export function answerStub(message: HostMessage): CoreMessage | null {
  switch (message.type) {
    case 'request':
      return jsonResponse(message.id, 503, STUB_ERROR_BODY);
    case 'control':
      return { type: 'control-result', id: message.id, ok: true };
    case 'cancel':
      return null;
  }
}

/** The part of the worker global scope the stub uses. */
export interface StubScope {
  postMessage(message: CoreMessage): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  close(): void;
}

/** Wires the stub to a worker scope and announces `ready`. */
export function startStub(scope: StubScope): void {
  scope.addEventListener('message', (event) => {
    const message = event.data;
    if (!isHostMessage(message)) return;
    const reply = answerStub(message);
    if (reply) scope.postMessage(reply);
    if (message.type === 'control' && message.action === 'shutdown') scope.close();
  });
  const ready: CoreReadyEvent = { type: 'event', name: 'ready', protocol: CORE_PROTOCOL_VERSION };
  scope.postMessage(ready);
}

// Start only when this file is the worker script (a worker has no `window`), not when a test
// imports it.
if (typeof window === 'undefined' && typeof self !== 'undefined') {
  startStub(self as unknown as StubScope);
}
