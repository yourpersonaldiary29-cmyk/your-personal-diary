import { describe, expect, it } from 'vitest';
import {
  CORE_CONTROL_ACTIONS,
  isCoreControlAction,
  isCoreMessage,
  isHostMessage,
  jsonResponse,
  transferList,
  type CoreRequest,
  type CoreResponse,
} from './transport';

describe('host <-> core protocol helpers', () => {
  it('knows the three control actions', () => {
    expect([...CORE_CONTROL_ACTIONS]).toEqual(['flushAll', 'lockAll', 'shutdown']);
    expect(isCoreControlAction('lockAll')).toBe(true);
    expect(isCoreControlAction('reboot')).toBe(false);
    expect(isCoreControlAction(undefined)).toBe(false);
  });

  it('accepts well-formed host messages only', () => {
    expect(isHostMessage({ type: 'request', id: 1, method: 'GET', url: '/api/health', headers: {} })).toBe(true);
    expect(isHostMessage({ type: 'cancel', id: 1 })).toBe(true);
    expect(isHostMessage({ type: 'control', id: 2, action: 'shutdown' })).toBe(true);

    expect(isHostMessage(null)).toBe(false);
    expect(isHostMessage('request')).toBe(false);
    expect(isHostMessage({ type: 'request', id: 1, method: 'GET', url: '/api/health' })).toBe(false);
    expect(isHostMessage({ type: 'request', id: 1.5, method: 'GET', url: '/', headers: {} })).toBe(false);
    expect(isHostMessage({ type: 'request', id: '1', method: 'GET', url: '/', headers: {} })).toBe(false);
    expect(isHostMessage({ type: 'control', id: 2, action: 'reboot' })).toBe(false);
    expect(isHostMessage({ type: 'response', id: 1, status: 200, headers: {} })).toBe(false);
  });

  it('accepts well-formed core messages only', () => {
    expect(isCoreMessage({ type: 'response', id: 1, status: 200, headers: {} })).toBe(true);
    expect(isCoreMessage({ type: 'control-result', id: 1, ok: false, message: 'busy' })).toBe(true);
    expect(isCoreMessage({ type: 'event', name: 'ready', protocol: 1 })).toBe(true);
    expect(isCoreMessage({ type: 'event', name: 'fatal', message: 'x' })).toBe(true);
    expect(isCoreMessage({ type: 'event', name: 'log', level: 'info', message: 'x' })).toBe(true);

    expect(isCoreMessage(undefined)).toBe(false);
    expect(isCoreMessage({ type: 'response', id: 1, status: '200', headers: {} })).toBe(false);
    expect(isCoreMessage({ type: 'response', status: 200, headers: {} })).toBe(false);
    expect(isCoreMessage({ type: 'control-result', id: 1 })).toBe(false);
    expect(isCoreMessage({ type: 'event', name: 'progress' })).toBe(false);
    expect(isCoreMessage({ type: 'request', id: 1, method: 'GET', url: '/', headers: {} })).toBe(false);
  });

  it('transfers the body bytes and nothing else', () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const withBytes: CoreRequest = { type: 'request', id: 1, method: 'POST', url: '/api/x', headers: {}, bodyBytes: bytes };
    expect(transferList(withBytes)).toEqual([bytes]);
    expect(transferList(withBytes)[0]).toBe(bytes);
    expect(transferList({ type: 'request', id: 1, method: 'POST', url: '/api/x', headers: {}, bodyText: '{}' })).toEqual([]);
    expect(transferList({ type: 'cancel', id: 1 })).toEqual([]);
    expect(transferList({ type: 'event', name: 'ready', protocol: 1 })).toEqual([]);
    const answer: CoreResponse = { type: 'response', id: 1, status: 200, headers: {}, bodyBytes: bytes };
    expect(transferList(answer)).toEqual([bytes]);
  });

  it('builds the JSON answer the desktop server would send', () => {
    expect(jsonResponse(3, 404, { code: 'NOT_FOUND', message: 'No such entry.' })).toEqual({
      type: 'response',
      id: 3,
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      bodyText: '{"code":"NOT_FOUND","message":"No such entry."}',
    });
  });
});
