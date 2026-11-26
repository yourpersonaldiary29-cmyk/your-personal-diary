/**
 * Strings of the owner's "Server" card (ServerSection.tsx; catalogue keys 'settings.server.*' in
 * shared/i18n/messages/<locale>/settings.ts), resolved in the current UI language. Like `ST` / `MT`,
 * every member is a getter or a function so call sites always read the live language.
 */
import { hasMessage } from '@shared/i18n';
import type { AppPlatform, ServerDiskEmail, ServerDiskReason, ServerDiskState, ServerDownloadEmail, ServerDownloadPlatform } from '@shared/types';
import { intlTag, tr } from '@/i18n/runtime';
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
  // Both numbers arrive formatted with the language's grouping ("4", "5,000"), like the rest of the card.
  accountsValue: (count: string, max: string) => tr('settings.server.accountsValue', { count, max }),
  get registrations() {
    return tr('settings.server.registrations');
  },
  get disk() {
    return tr('settings.server.disk');
  },
  diskValue: (used: string, free: string, percent: string) => tr('settings.server.diskValue', { used, free, percent }),
  diskLow: (percent: string) => tr('settings.server.diskLow', { percent }),
  // "Enough for" (ServerStatus.capacity): `count` picks the plural form, `users` / `atQuota` / `max` are
  // the numbers already formatted with the language's grouping ("2,800"), the sizes come from
  // formatServerBytes and the percentage from formatPercent; `copies` is the server's own factor.
  get capacity() {
    return tr('settings.server.capacity');
  },
  capacityValue: (count: number, users: string, atQuota: string, quota: string) => tr('settings.server.capacityValue', { count, users, atQuota, quota }),
  capacityValueNoQuota: (count: number, users: string) => tr('settings.server.capacityValueNoQuota', { count, users }),
  capacityHint: (copies: number, percent: string, size: string, average: string) => tr('settings.server.capacityHint', { copies, percent, size, average }),
  capacityHintNoDiaries: (copies: number, percent: string, size: string) => tr('settings.server.capacityHintNoDiaries', { copies, percent, size }),
  capacityNote: (max: string) => tr('settings.server.capacityNote', { max }),
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

/** A monthly cost in US dollars as the current language writes money ("US$7.50" in English, "7,50 $" in German). */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat(intlTag(), { style: 'currency', currency: 'USD' }).format(amount);
}

/**
 * What happened to the e-mail about an action of the card ('settings.server.email.*'): the downloads
 * spell the reasons in camel case ('notConfigured'), the disk with hyphens ('not-configured').
 */
export function emailOutcome(email: ServerDownloadEmail | ServerDiskEmail): string {
  switch (email) {
    case 'sent':
      return tr('settings.server.email.sent');
    case 'notConfigured':
    case 'not-configured':
      return tr('settings.server.email.notConfigured');
    case 'noAddress':
    case 'no-address':
      return tr('settings.server.email.noAddress');
    default:
      return tr('settings.server.email.failed');
  }
}

/** "Files on the Downloads page" (ServerDownloads.tsx; keys 'settings.server.downloads.*'). */
export const DLT = {
  get title() {
    return tr('settings.server.downloads.title');
  },
  get intro() {
    return tr('settings.server.downloads.intro');
  },
  get platform() {
    return tr('settings.server.downloads.platform');
  },
  /** "Windows", "Android", "Mac" - the names the server's messages use too. */
  platformName: (platform: ServerDownloadPlatform) => tr(`settings.server.downloads.platform.${platform}`),
  get version() {
    return tr('settings.server.downloads.version');
  },
  get size() {
    return tr('settings.server.downloads.size');
  },
  get date() {
    return tr('settings.server.downloads.date');
  },
  get source() {
    return tr('settings.server.downloads.source');
  },
  sourceName: (source: 'image' | 'uploaded') => tr(`settings.server.downloads.source.${source}`),
  get empty() {
    return tr('settings.server.downloads.empty');
  },
  get remove() {
    return tr('settings.server.downloads.remove');
  },
  removeName: (version: string, platform: string) => tr('settings.server.downloads.removeName', { version, platform }),
  removeTitle: (version: string, platform: string) => tr('settings.server.downloads.removeTitle', { version, platform }),
  removeUploaded: (file: string) => tr('settings.server.downloads.removeUploaded', { file }),
  removeImage: (file: string) => tr('settings.server.downloads.removeImage', { file }),
  get removeAgain() {
    return tr('settings.server.downloads.removeAgain');
  },
  removed: (version: string, platform: string) => tr('settings.server.downloads.removed', { version, platform }),
  /** Said when the file being removed is the only one of its system (in the dialog, then in the result). */
  removeLast: (platform: string) => tr('settings.server.downloads.removeLast', { platform }),
  removedLast: (platform: string) => tr('settings.server.downloads.removedLast', { platform }),
  /** Said before an action when the e-mail about it would not be sent (`ServerDownloads.email`). */
  emailWarning: (email: 'notConfigured' | 'noAddress') =>
    tr(email === 'noAddress' ? 'settings.server.downloads.emailNoAddress' : 'settings.server.downloads.emailNotConfigured'),
  get publishTitle() {
    return tr('settings.server.downloads.publishTitle');
  },
  get publishIntro() {
    return tr('settings.server.downloads.publishIntro');
  },
  // The four numbers arrive formatted with the language's grouping.
  limits: (minMb: string, maxMb: string, usedToday: string, perDay: string) =>
    tr('settings.server.downloads.limits', { minMb, maxMb, usedToday, perDay }),
  versionHint: (version: string) => tr('settings.server.downloads.versionHint', { version }),
  get file() {
    return tr('settings.server.downloads.file');
  },
  fileHint: (extension: string) => tr('settings.server.downloads.fileHint', { extension }),
  get fileMissing() {
    return tr('settings.server.downloads.fileMissing');
  },
  fileWrongType: (extension: string, platform: string) => tr('settings.server.downloads.fileWrongType', { extension, platform }),
  get removeOlder() {
    return tr('settings.server.downloads.removeOlder');
  },
  get removeOlderHint() {
    return tr('settings.server.downloads.removeOlderHint');
  },
  get upload() {
    return tr('settings.server.downloads.upload');
  },
  get progress() {
    return tr('settings.server.downloads.progress');
  },
  /** `percent` arrives formatted ("45%"). */
  uploading: (percent: string) => tr('settings.server.downloads.uploading', { percent }),
  get checking() {
    return tr('settings.server.downloads.checking');
  },
  get cancel() {
    return tr('settings.server.downloads.cancel');
  },
  get cancelled() {
    return tr('settings.server.downloads.cancelled');
  },
  get interrupted() {
    return tr('settings.server.downloads.interrupted');
  },
  get passwordAgain() {
    return tr('settings.server.downloads.passwordAgain');
  },
  get busy() {
    return tr('settings.server.downloads.busy');
  },
  published: (version: string, platform: string) => tr('settings.server.downloads.published', { version, platform }),
  removedOlder: (versions: string) => tr('settings.server.downloads.removedOlder', { versions }),
  // The form is checked before the upload in the server's own words (server.downloads.*): what the
  // server checks again then says exactly the same.
  get versionInvalid() {
    return tr('server.downloads.versionInvalid');
  },
  exists: (platform: string, version: string) => tr('server.downloads.exists', { platform, version }),
  tooLarge: (maxMb: number) => tr('server.downloads.tooLarge', { maxMb }),
  tooSmall: (minMb: number) => tr('server.downloads.tooSmall', { minMb }),
};

/** "Required update" (ServerAppUpdate.tsx; keys 'settings.server.update.*'). */
export const UPT = {
  get title() {
    return tr('settings.server.update.title');
  },
  get intro() {
    return tr('settings.server.update.intro');
  },
  get warning() {
    return tr('settings.server.update.warning');
  },
  get offline() {
    return tr('settings.server.update.offline');
  },
  /** "Android", "iPhone", "Windows", "Mac" - never translated. */
  platformName: (platform: AppPlatform) => tr(`settings.server.update.platform.${platform}`),
  get versionLabel() {
    return tr('settings.server.update.versionLabel');
  },
  get versionHint() {
    return tr('settings.server.update.versionHint');
  },
  newestHint: (version: string) => tr('settings.server.update.newestHint', { version }),
  get stateOff() {
    return tr('settings.server.update.stateOff');
  },
  stateOn: (version: string) => tr('settings.server.update.stateOn', { version }),
  get save() {
    return tr('settings.server.update.save');
  },
  saveFor: (platform: string) => tr('settings.server.update.saveFor', { platform }),
  get turnOff() {
    return tr('settings.server.update.turnOff');
  },
  turnOffFor: (platform: string) => tr('settings.server.update.turnOffFor', { platform }),
  get saved() {
    return tr('settings.server.update.saved');
  },
  get turnedOff() {
    return tr('settings.server.update.turnedOff');
  },
  get invalidVersion() {
    return tr('settings.server.update.invalidVersion');
  },
  tooNew: (version: string) => tr('settings.server.update.tooNew', { version }),
  /** Said before a change when the e-mail about it would not be sent (`ServerAppUpdate.email`). */
  emailWarning: (email: 'notConfigured' | 'noAddress') =>
    tr(email === 'noAddress' ? 'settings.server.update.emailNoAddress' : 'settings.server.update.emailNotConfigured'),
};

/** The server's text of each `ServerDiskReason` (server/src/hosted/disk-errors.ts DISK_REASON_KEYS). */
const DISK_REASON_KEYS: Readonly<Record<ServerDiskReason, string>> = {
  'not-fly': 'server.disk.reason.notFly',
  'no-token': 'server.disk.reason.noToken',
  'bad-token': 'server.disk.reason.badToken',
  'no-volume': 'server.disk.reason.noVolume',
  unauthorized: 'server.disk.reason.unauthorized',
  'fly-error': 'server.disk.reason.flyError',
};

/** The catalogue name of a state ('needs-restart' -> 'needsRestart'). */
const stateKey = (state: ServerDiskState) => (state === 'needs-restart' ? 'needsRestart' : state);

/** A step of a change: the backup copy, enlarging, the server using the new size. */
export type DiskStep = 'snapshot' | 'extend' | 'use';
/** Where a step stands; 'restart': it happens after the restart the owner asks for. */
export type DiskStepState = 'done' | 'current' | 'pending' | 'restart';

/** "Disk size" (ServerDisk.tsx; keys 'settings.server.diskSize.*'). */
export const DKT = {
  get title() {
    return tr('settings.server.diskSize.title');
  },
  get intro() {
    return tr('settings.server.diskSize.intro');
  },
  /**
   * Why the button cannot be used, in the server's words ('server.disk.reason.*'); a reason this app
   * does not know yet (a newer server) gets the general sentence.
   */
  reason: (reason: ServerDiskReason | undefined) => tr((reason && DISK_REASON_KEYS[reason]) || 'server.disk.unavailable'),
  /** Why a change failed, or why its restart did not happen (`ServerDiskChange.errorKey`, 'server.disk.error.*'). */
  errorText: (errorKey: string) => (errorKey.startsWith('server.disk.') && hasMessage('en', errorKey) ? tr(errorKey) : tr('shell.genericError')),
  /** "50 GB". */
  gigabytes: (gb: number) => tr('settings.server.gigabytes', { value: formatNumber(gb) }),
  get sizeNow() {
    return tr('settings.server.diskSize.sizeNow');
  },
  get used() {
    return tr('settings.server.diskSize.used');
  },
  usedValue: (used: string, total: string, percent: string) => tr('settings.server.diskSize.usedValue', { used, total, percent }),
  get costNow() {
    return tr('settings.server.diskSize.costNow');
  },
  get changesLeft() {
    return tr('settings.server.diskSize.changesLeft');
  },
  changesLeftValue: (left: string, max: string) => tr('settings.server.diskSize.changesLeftValue', { left, max }),
  noChangesLeft: (max: number) => tr('settings.server.diskSize.noChangesLeft', { max }),
  nextChangeAt: (time: string) => tr('settings.server.diskSize.nextChangeAt', { time }),
  atMax: (max: string) => tr('settings.server.diskSize.atMax', { max }),
  get formTitle() {
    return tr('settings.server.diskSize.formTitle');
  },
  get newSize() {
    return tr('settings.server.diskSize.newSize');
  },
  newSizeHint: (min: string, max: string) => tr('settings.server.diskSize.newSizeHint', { min, max }),
  newSizeInvalid: (min: string, max: string) => tr('settings.server.diskSize.newSizeInvalid', { min, max }),
  /** `size` arrives formatted, `cost` from formatUsd. */
  cost: (size: string, cost: string) => tr('settings.server.diskSize.cost', { size, cost }),
  get onlyGrow() {
    return tr('settings.server.diskSize.onlyGrow');
  },
  get enlarge() {
    return tr('settings.server.diskSize.enlarge');
  },
  changeTitle: (fromGb: string, toGb: string) => tr('settings.server.diskSize.changeTitle', { fromGb, toGb }),
  changeStarted: (time: string) => tr('settings.server.diskSize.changeStarted', { time }),
  step: (step: DiskStep) => tr(`settings.server.diskSize.step.${step}`),
  stepState: (state: DiskStepState) => tr(`settings.server.diskSize.stepState.${state}`),
  stepLine: (step: string, state: string) => tr('settings.server.diskSize.stepLine', { step, state }),
  /** What the change is doing now, as a sentence (the sizes arrive formatted). */
  state: (state: ServerDiskState, fromGb: string, toGb: string) => tr(`settings.server.diskSize.state.${stateKey(state)}`, { fromGb, toGb }),
  /** The state as a short word or two for the list of changes. */
  status: (state: ServerDiskState) => tr(`settings.server.diskSize.status.${stateKey(state)}`),
  get restartHint() {
    return tr('settings.server.diskSize.restartHint');
  },
  get restart() {
    return tr('settings.server.diskSize.restart');
  },
  get notAnswering() {
    return tr('settings.server.diskSize.notAnswering');
  },
  get setupCommand() {
    return tr('settings.server.diskSize.setupCommand');
  },
  get setupHint() {
    return tr('settings.server.diskSize.setupHint');
  },
  get copySetup() {
    return tr('settings.server.diskSize.copySetup');
  },
  get historyTitle() {
    return tr('settings.server.diskSize.historyTitle');
  },
  historyItem: (fromGb: string, toGb: string, state: string, time: string) => tr('settings.server.diskSize.historyItem', { fromGb, toGb, state, time }),
};
