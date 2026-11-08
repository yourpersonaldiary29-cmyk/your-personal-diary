/**
 * Fake platform seams of the offline e2e test (docs/android-tasks/OFFLINE-DESIGN.md section 9
 * "Platform seams"): an in-memory key vault (the Android Keystore / DPAPI), an in-memory outbox
 * mirror (the app-private folder) and a device user check (the phone's screen lock). They are
 * installed ONLY by mobile/test/hosted-offline.test.ts through `setOfflinePlatform` - nothing in
 * src/ or mobile/ (outside mobile/test) imports this module, and the test asserts that no shipped
 * bundle contains `FAKE_SEAMS_MARKER`.
 *
 * Unlike the engine's own unit fakes (src/offline/test-utils/env.ts) the vault here really wraps:
 * AES-GCM under a per-device "hardware" key that never leaves this object, with the user id as
 * additional data - a blob copied to another device or another account does not unwrap.
 */
import type { DeviceUserCheck, OfflineKeyVault, OutboxMirror } from '@/offline';

/** A string only this module contains: the shipped bundles are searched for it. */
export const FAKE_SEAMS_MARKER = 'ypd-e2e-fake-offline-seams-7f3c1a';

export interface E2eKeyVault extends OfflineKeyVault {
  /** Wrapped blobs by user id (what the Keystore alias / the DPAPI blob would hold). */
  readonly blobs: Map<string, string>;
  readonly calls: string[];
}

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** A key vault whose wrapping key lives only in this object (the secure hardware of one device). */
export function e2eKeyVault(kind: 'keystore' | 'dpapi' = 'keystore'): E2eKeyVault {
  const blobs = new Map<string, string>();
  const calls: string[] = [];
  let hardwareKey: Promise<CryptoKey> | null = null;
  const key = () => (hardwareKey ??= crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));
  const aad = (userId: string) => new TextEncoder().encode(`${FAKE_SEAMS_MARKER}|${kind}|${userId}`);
  return {
    kind,
    blobs,
    calls,
    async wrap(userId, raw) {
      calls.push(`wrap ${userId}`);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(userId) }, await key(), new Uint8Array(raw)));
      const blob = `${b64(iv)}.${b64(ct)}`;
      blobs.set(userId, blob);
      return blob;
    },
    async unwrap(userId, blob) {
      calls.push(`unwrap ${userId}`);
      const [iv, ct] = blob.split('.');
      if (!iv || !ct) throw new Error('not a wrapped key');
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: aad(userId) }, await key(), unb64(ct));
      return new Uint8Array(plain);
    },
    async remove(userId) {
      calls.push(`remove ${userId}`);
      blobs.delete(userId);
    },
  };
}

export interface E2eMirror extends OutboxMirror {
  /** userId -> file name -> bytes (the app-private folder `offline/<userId>/`). */
  readonly files: Map<string, Map<string, Uint8Array>>;
  names(userId: string): string[];
}

/** An outbox mirror in memory: survives an engine restart and an IndexedDB eviction, like the native folder. */
export function e2eMirror(): E2eMirror {
  const files = new Map<string, Map<string, Uint8Array>>();
  const dir = (userId: string) => {
    let d = files.get(userId);
    if (!d) {
      d = new Map();
      files.set(userId, d);
    }
    return d;
  };
  return {
    files,
    names: (userId) => [...(files.get(userId)?.keys() ?? [])].sort(),
    async put(userId, name, bytes) {
      dir(userId).set(name, new Uint8Array(bytes));
    },
    async list(userId) {
      return [...dir(userId).keys()];
    },
    async read(userId, name) {
      const bytes = files.get(userId)?.get(name);
      if (!bytes) throw new Error(`no mirror file ${name}`);
      return new Uint8Array(bytes);
    },
    async remove(userId, name) {
      files.get(userId)?.delete(name);
    },
    async clear(userId) {
      files.delete(userId);
    },
  };
}

export interface E2eUserCheck extends DeviceUserCheck {
  /** The answers the next checks give (the last one repeats). */
  answers: Awaited<ReturnType<DeviceUserCheck['verify']>>[];
  readonly reasons: string[];
}

/** The phone's own screen lock: available, answers 'ok' unless told otherwise. */
export function e2eUserCheck(): E2eUserCheck {
  const check: E2eUserCheck = {
    answers: ['ok'],
    reasons: [],
    async available() {
      return check.answers[0] !== 'unavailable';
    },
    async verify(reason) {
      check.reasons.push(reason);
      return check.answers.length > 1 ? (check.answers.shift() as 'ok') : check.answers[0];
    },
  };
  return check;
}
