import { AREA_NAMES, DEFAULT_LOCALE, t, type Locale, type Params } from '@shared/i18n';
import type { ApiErrorBody, ErrorCode } from '@shared/types';

/**
 * Error carrying an HTTP status and a stable code. `message` is user-facing;
 * never put stack traces or file paths in it.
 *
 * Two flavours:
 *  - localised: `ApiError.localized(400, 'VALIDATION', 'server.entries.badDate', params, field)`
 *    carries a catalogue key + params, and the error middleware renders the message
 *    in the request locale (`toBody(req.locale)`). `message` itself holds the English
 *    rendering (logs, tests). A param may itself be a nested catalogue reference
 *    (`ref('server.entries.field.title')`) so labels are translated too;
 *  - literal: `new ApiError(400, 'VALIDATION', 'text')` - the message is sent as is
 *    (tests and ad-hoc callers; every server module uses keys).
 *
 * The convenience constructors accept either a catalogue key ('server.xxx.yyy') or a
 * literal message: `isMessageKey` tells them apart. `ApiError.io('server.vault.writeFailed')`
 * is fully localised; `ApiError.io('disk full')` still renders its wrapper sentence
 * ("File error: {message}") in the request language, with the literal as the parameter.
 */

/** A nested catalogue reference used as a parameter of a localised message (may nest further). */
export interface MessageRef {
  key: string;
  params?: ErrorParams;
}

export type ErrorParamValue = Params[string] | MessageRef;
export type ErrorParams = Record<string, ErrorParamValue>;

/** Builds a nested catalogue reference: `{ label: ref('server.entries.field.title') }`. */
export function ref(key: string, params?: ErrorParams): MessageRef {
  return params ? { key, params } : { key };
}

function isMessageRef(v: ErrorParamValue): v is MessageRef {
  return typeof v === 'object' && v !== null && typeof (v as MessageRef).key === 'string';
}

const KEY_RE = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9_-]+)+$/;

/** True when `s` looks like a catalogue key ('area.some.key') rather than a literal message. */
export function isMessageKey(s: string): boolean {
  if (!KEY_RE.test(s)) return false;
  return (AREA_NAMES as readonly string[]).includes(s.slice(0, s.indexOf('.')));
}

/** Renders nested references in `locale`, leaving plain values untouched. */
export function resolveParams(locale: Locale, params?: ErrorParams): Params | undefined {
  if (!params) return undefined;
  const out: Params = {};
  for (const [name, value] of Object.entries(params)) {
    out[name] = isMessageRef(value) ? renderMessage(locale, value.key, value.params) : value;
  }
  return out;
}

/** Translates `key` in `locale` after resolving nested references. */
export function renderMessage(locale: Locale, key: string, params?: ErrorParams): string {
  return t(locale, key, resolveParams(locale, params));
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly field?: string;
  /** Catalogue key of a localised error (see `ApiError.localized`). */
  readonly key?: string;
  readonly params?: ErrorParams;
  /** When set, the error middleware adds a `Retry-After` header with this many seconds (503 busy). */
  retryAfterSec?: number;

  constructor(status: number, code: ErrorCode, message: string, field?: string, key?: string, params?: ErrorParams) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
    if (key) {
      this.key = key;
      this.params = params;
    }
  }

  /** Error whose message is rendered per request locale from the catalogue. */
  static localized(status: number, code: ErrorCode, key: string, params?: ErrorParams, field?: string): ApiError {
    return new ApiError(status, code, renderMessage(DEFAULT_LOCALE, key, params), field, key, params);
  }

  /** The message in `locale` (catalogue rendering for localised errors, the literal otherwise). */
  messageFor(locale: Locale): string {
    return this.key ? renderMessage(locale, this.key, this.params) : this.message;
  }

  /** Response body; pass the request locale so localised errors render in it. */
  toBody(locale: Locale = DEFAULT_LOCALE): ApiErrorBody {
    const body: ApiErrorBody = { code: this.code, message: this.messageFor(locale) };
    if (this.field) body.field = this.field;
    return body;
  }

  // Convenience constructors -------------------------------------------------
  // `message` is a catalogue key (localised) or a literal text (sent as is).

  /**
   * Key or literal. With a `wrapper` key ('server.error.db' = "Database error: {message}") the
   * error is always localised: a catalogue key becomes a nested reference, a literal text is
   * inserted as the `{message}` parameter, so the wrapper sentence still follows the request
   * language. Without a wrapper a literal message is sent as it is.
   */
  private static keyed(
    status: number,
    code: ErrorCode,
    message: string,
    params: ErrorParams | undefined,
    field: string | undefined,
    wrapper: { key: string; param: string } | null,
  ): ApiError {
    if (isMessageKey(message)) {
      return wrapper
        ? ApiError.localized(status, code, wrapper.key, { [wrapper.param]: ref(message, params) }, field)
        : ApiError.localized(status, code, message, params, field);
    }
    if (wrapper) return ApiError.localized(status, code, wrapper.key, { [wrapper.param]: message }, field);
    return new ApiError(status, code, message, field);
  }

  static validation(message: string, field?: string, params?: ErrorParams): ApiError {
    return ApiError.keyed(400, 'VALIDATION', message, params, field, null);
  }
  /** `what` is a catalogue key naming the missing thing ('server.entries.notFound') or a literal name. */
  static notFound(what = 'server.error.notFound.item', params?: ErrorParams): ApiError {
    return ApiError.keyed(404, 'NOT_FOUND', what, params, undefined, { key: 'server.error.notFound', param: 'what' });
  }
  static unauthorized(message = 'server.error.unauthorized', params?: ErrorParams): ApiError {
    return ApiError.keyed(401, 'UNAUTHORIZED', message, params, undefined, null);
  }
  static sessionExpired(): ApiError {
    return ApiError.localized(401, 'SESSION_EXPIRED', 'server.error.sessionExpired');
  }
  static wrongPassword(): ApiError {
    return ApiError.localized(401, 'WRONG_PASSWORD', 'server.error.wrongPassword');
  }
  static weakPassword(message: string, params?: ErrorParams): ApiError {
    return ApiError.keyed(400, 'WEAK_PASSWORD', message, params, 'password', null);
  }
  static usernameTaken(): ApiError {
    return ApiError.localized(409, 'USERNAME_TAKEN', 'server.error.usernameTaken', undefined, 'username');
  }
  static forbidden(message = 'server.error.forbidden', params?: ErrorParams): ApiError {
    return ApiError.keyed(403, 'FORBIDDEN', message, params, undefined, null);
  }
  /** 423: the session is locked by the lock screen; the password unlocks it. */
  static locked(): ApiError {
    return ApiError.localized(423, 'LOCKED', 'server.auth.sessionLocked');
  }
  static lanDisabled(): ApiError {
    return ApiError.localized(403, 'LAN_DISABLED', 'server.error.lanDisabled');
  }
  static db(message: string, params?: ErrorParams): ApiError {
    return ApiError.keyed(500, 'DB', message, params, undefined, { key: 'server.error.db', param: 'message' });
  }
  static crypto(message: string, params?: ErrorParams): ApiError {
    return ApiError.keyed(500, 'CRYPTO', message, params, undefined, { key: 'server.error.crypto', param: 'message' });
  }
  static io(message: string, params?: ErrorParams): ApiError {
    return ApiError.keyed(500, 'IO', message, params, undefined, { key: 'server.error.io', param: 'message' });
  }
  static backup(message: string, params?: ErrorParams): ApiError {
    return ApiError.keyed(400, 'BACKUP', message, params, undefined, { key: 'server.error.backup', param: 'message' });
  }
  static exportErr(message: string, params?: ErrorParams): ApiError {
    return ApiError.keyed(500, 'EXPORT', message, params, undefined, { key: 'server.error.export', param: 'message' });
  }
  static other(message: string, params?: ErrorParams): ApiError {
    return ApiError.keyed(500, 'OTHER', message, params, undefined, null);
  }
  /** 503 'server.error.busy' with `Retry-After: 2` - the derivation queue of a hosted server is full. */
  static busy(retryAfterSec = 2): ApiError {
    const e = ApiError.localized(503, 'OTHER', 'server.error.busy');
    e.retryAfterSec = retryAfterSec;
    return e;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
