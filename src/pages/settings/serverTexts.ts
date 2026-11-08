/**
 * Strings of the owner's "Server" card (ServerSection.tsx; catalogue keys 'settings.server.*' in
 * shared/i18n/messages/<locale>/settings.ts), resolved in the current UI language. Like `ST` / `MT`,
 * every member is a getter or a function so call sites always read the live language.
 */
import { tr } from '@/i18n/runtime';
import { formatBytes, formatDays, formatMinutes, formatNumber } from '@/utils/format';

const GIB = 1024 ** 3;

/** Bytes as text: "512 KB", "120.5 MB", "2.4 GB" (the shared helper stops at MB; a volume is counted in GB). */
export function formatServerBytes(bytes: number): string {
  if (bytes < GIB) return formatBytes(bytes);
  return tr('settings.server.gigabytes', { value: formatNumber(bytes / GIB, 1) });
}

/** How long the server has been running: "45 minutes", "3 hours and 5 minutes", "3 days". */
export function formatUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86_400);
  if (days >= 1) return formatDays(days);
  return formatMinutes(Math.floor(s / 60));
}

export const SVT = {
  get title() {
    return tr('settings.server.title');
  },
  get intro() {
    return tr('settings.server.intro');
  },
  get refresh() {
    return tr('settings.server.refresh');
  },
  get refreshed() {
    return tr('settings.server.refreshed');
  },
  get version() {
    return tr('settings.server.version');
  },
  get uptime() {
    return tr('settings.server.uptime');
  },
  get accounts() {
    return tr('settings.server.accounts');
  },
  accountsValue: (count: number, max: number) => tr('settings.server.accountsValue', { count, max }),
  get registrations() {
    return tr('settings.server.registrations');
  },
  get disk() {
    return tr('settings.server.disk');
  },
  diskValue: (used: string, free: string, percent: string) => tr('settings.server.diskValue', { used, free, percent }),
  diskLow: (percent: string) => tr('settings.server.diskLow', { percent }),
  get storage() {
    return tr('settings.server.storage');
  },
  get storageOk() {
    return tr('settings.server.storageOk');
  },
  get storageFailed() {
    return tr('settings.server.storageFailed');
  },
  get storageAlert() {
    return tr('settings.server.storageAlert');
  },
  get lastSave() {
    return tr('settings.server.lastSave');
  },
  get noSaveYet() {
    return tr('settings.server.noSaveYet');
  },
  get memory() {
    return tr('settings.server.memory');
  },
  get lastArchive() {
    return tr('settings.server.lastArchive');
  },
  get noArchive() {
    return tr('settings.server.noArchive');
  },
  get archiveDueNone() {
    return tr('settings.server.archiveDueNone');
  },
  archiveDueOld: (days: number) => tr('settings.server.archiveDueOld', { days }),

  // The archive section.
  get archiveTitle() {
    return tr('settings.server.archive.title');
  },
  get archiveIntro() {
    return tr('settings.server.archive.intro');
  },
  get listTitle() {
    return tr('settings.server.archive.listTitle');
  },
  get created() {
    return tr('settings.server.archive.created');
  },
  get size() {
    return tr('settings.server.archive.size');
  },
  get downloadCommand() {
    return tr('settings.server.archive.download');
  },
  get checkCommand() {
    return tr('settings.server.archive.check');
  },
  get copyDownload() {
    return tr('settings.server.archive.copyDownload');
  },
  get copyCheck() {
    return tr('settings.server.archive.copyCheck');
  },
  get copied() {
    return tr('settings.server.archive.copied');
  },
  get copyFailed() {
    return tr('settings.server.archive.copyFailed');
  },
  get stepsTitle() {
    return tr('settings.server.archive.stepsTitle');
  },
  /** The download steps, in order. */
  steps: (): string[] => ['open', 'download', 'check', 'keep'].map((step) => tr(`settings.server.archive.step.${step}`)),
  get prepare() {
    return tr('settings.server.archive.prepare');
  },
  get formTitle() {
    return tr('settings.server.archive.formTitle');
  },
  get password() {
    return tr('settings.server.archive.password');
  },
  get passphrase() {
    return tr('settings.server.archive.passphrase');
  },
  passphraseHint: (min: number) => tr('settings.server.archive.passphraseHint', { min }),
  get passphraseRepeat() {
    return tr('settings.server.archive.passphraseRepeat');
  },
  get passphraseWarning() {
    return tr('settings.server.archive.passphraseWarning');
  },
  get passwordMissing() {
    return tr('settings.server.archive.passwordMissing');
  },
  passphraseShort: (min: number) => tr('settings.server.archive.passphraseShort', { min }),
  passphraseLong: (max: number) => tr('settings.server.archive.passphraseLong', { max }),
  get passphraseMismatch() {
    return tr('settings.server.archive.passphraseMismatch');
  },
  get submit() {
    return tr('settings.server.archive.submit');
  },
  get preparing() {
    return tr('settings.server.archive.preparing');
  },
  ready: (name: string, size: string) => tr('settings.server.archive.ready', { name, size }),
  get busy() {
    return tr('settings.server.archive.busy');
  },
  nextAt: (time: string) => tr('settings.server.archive.nextAt', { time }),
};

/** "Deletion request by e-mail" (DeletionRequest.tsx; keys 'settings.server.deletion.*'). */
export const DRT = {
  get title() {
    return tr('settings.server.deletion.title');
  },
  get intro() {
    return tr('settings.server.deletion.intro');
  },
  get check() {
    return tr('settings.server.deletion.check');
  },
  get email() {
    return tr('settings.server.deletion.email');
  },
  get waiting() {
    return tr('settings.server.deletion.waiting');
  },
  get encoded() {
    return tr('settings.server.deletion.encoded');
  },
  get find() {
    return tr('settings.server.deletion.find');
  },
  get findHint() {
    return tr('settings.server.deletion.findHint');
  },
  get copyFind() {
    return tr('settings.server.deletion.copyFind');
  },
  get username() {
    return tr('settings.server.deletion.username');
  },
  get usernameHint() {
    return tr('settings.server.deletion.usernameHint');
  },
  get usernameInvalid() {
    return tr('settings.server.deletion.usernameInvalid');
  },
  get delete() {
    return tr('settings.server.deletion.delete');
  },
  get deleteHint() {
    return tr('settings.server.deletion.deleteHint');
  },
  get copyDelete() {
    return tr('settings.server.deletion.copyDelete');
  },
};
