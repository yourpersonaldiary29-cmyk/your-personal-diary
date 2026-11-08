/**
 * Error helpers: turn any thrown value into a message for the UI in the
 * current language (the server already renders ApiError messages in the
 * request's language).
 */
import { isApiClientError } from '@/api';
import type { ErrorCode } from '@shared/types';
import { T } from '@/constants/texts';

/** Localised message for any error (ApiClientError, Error, string, unknown). */
export function errorMessage(e: unknown, fallback: string = T.genericError): string {
  if (isApiClientError(e)) return e.message || fallback;
  if (e instanceof Error) {
    if (e.name === 'AbortError') return '';
    return e.message || fallback;
  }
  if (typeof e === 'string' && e.trim()) return e;
  return fallback;
}

/** Stable error code when the error came from the API, otherwise null. */
export function errorCode(e: unknown): ErrorCode | null {
  return isApiClientError(e) ? e.code : null;
}

/** Field name for validation errors reported by the server, otherwise null. */
export function errorField(e: unknown): string | null {
  return isApiClientError(e) && e.field ? e.field : null;
}

/** True when the error is an aborted request (component unmounted) and should be ignored. */
export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}
