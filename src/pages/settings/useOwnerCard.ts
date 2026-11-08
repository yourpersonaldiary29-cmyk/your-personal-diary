/**
 * Whether the Settings page may render one of the owner-only cards of this
 * computer - "Remote access" (RemoteAccessSection) and "E-mail for password
 * reset" (MailSection):
 *   - only on the computer itself (`server.info().isLocalRequest`): their
 *     endpoints answer loopback requests only - except on the hosted Your
 *     Personal Diary server (`mode: 'hosted'`), which has no loopback client
 *     and answers its configured owner from anywhere (over its HTTPS edge);
 *   - only for the owner of this computer's diary - the account created first
 *     on it (or the account that set the feature up before that rule existed);
 *     on the hosted server the configured owner (`DIARY_OWNER_ID`).
 *     `GET /api/server/settings` says so (`isRemoteOwner` / `isMailOwner`), so
 *     another account never renders the card and never even asks for its
 *     settings (the hosted server reports `isRemoteOwner: false` to everyone -
 *     it has no remote access of its own - and `isMailOwner` to its owner only).
 * A server that does not report the flag (an older version), or that cannot be
 * asked, lets the card load: its own request then answers 403 FORBIDDEN to any
 * other account and the card stays away (see the cards' `refused` state).
 *
 * False until the server has answered (nothing flashes for other accounts).
 *
 * The read behind it (`useOwnerAccess`) is SHARED per flag while mounted: every
 * component that asks for the same flag while another one is mounted gets the
 * same answer, without a request of its own. The Account card's ID row
 * (AccountSection, docs/android-tasks/OWNER-ID-VISIBILITY.md) needs exactly the
 * Mail card's `isMailOwner` - and the server's `ownerConfigured` as it is NOW, not
 * the start-up probe kept in the connection store - so it rides on the Mail
 * card's two requests. The read is forgotten when its last user unmounts: the
 * next visit of the Settings page asks the server again (both answers are live
 * there, e.g. `ownerConfigured` right after the owner set DIARY_OWNER_ID).
 */
import { useEffect } from 'react';
import type { ServerInfo, ServerSettings } from '@shared/types';
import { server as serverApi } from '@/api';
import { useApi } from '@/hooks/useApi';
import { isAbortError } from '@/utils/errors';

export type OwnerFlag = keyof Pick<ServerSettings, 'isRemoteOwner' | 'isMailOwner'>;

/** What the server answered for the owner cards on this visit of the Settings page. */
export interface OwnerAccess {
  /** `GET /api/server/info` as the server answered it just now; null when it gave nothing. */
  info: ServerInfo | null;
  /** False when the settings were not asked for: the page is neither on the computer itself nor on the hosted server. */
  asked: boolean;
  /** `GET /api/server/settings`; null when not asked, or when the request failed or was refused (an older server's 403). */
  settings: ServerSettings | null;
}

async function readOwnerAccess(): Promise<OwnerAccess> {
  const info = (await serverApi.info()) ?? null;
  if (!info?.isLocalRequest && info?.mode !== 'hosted') return { info, asked: false, settings: null };
  try {
    return { info, asked: true, settings: (await serverApi.getSettings()) ?? null };
  } catch (e) {
    if (isAbortError(e)) throw e;
    return { info, asked: true, settings: null };
  }
}

/** One read per flag, kept while at least one component that asked for it is mounted. */
interface SharedRead {
  users: number;
  promise: Promise<OwnerAccess> | null;
}
const sharedReads = new Map<OwnerFlag, SharedRead>();

function sharedRead(flag: OwnerFlag): Promise<OwnerAccess> {
  const entry = sharedReads.get(flag);
  // Not subscribed (cannot happen through the hook - its subscription effect runs first): a read of its own.
  if (!entry) return readOwnerAccess();
  entry.promise ??= readOwnerAccess();
  return entry.promise;
}

/**
 * The server's answers for the owner cards (see the module comment), null until they arrived (or when
 * `GET /api/server/info` failed). `enabled: false` asks nothing and joins no read.
 */
export function useOwnerAccess(flag: OwnerFlag, enabled = true): OwnerAccess | null {
  // Declared before useApi: its effect registers this user before the read starts (or is joined).
  useEffect(() => {
    if (!enabled) return;
    let entry = sharedReads.get(flag);
    if (!entry) {
      entry = { users: 0, promise: null };
      sharedReads.set(flag, entry);
    }
    entry.users += 1;
    const mine = entry;
    return () => {
      mine.users -= 1;
      if (mine.users === 0 && sharedReads.get(flag) === mine) sharedReads.delete(flag);
    };
  }, [flag, enabled]);
  return useApi(() => sharedRead(flag), [flag], { enabled }).data;
}

export function useOwnerCard(flag: OwnerFlag): boolean {
  const access = useOwnerAccess(flag);
  return access !== null && access.asked && access.settings?.[flag] !== false;
}
