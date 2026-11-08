/**
 * Strings of the settings and backup pages, resolved in the current UI
 * language through `tr()` (catalogue area 'settings', see
 * shared/i18n/messages/<locale>/settings.ts). Every member is a getter or a
 * function so call sites (`ST.account`) read the live language; shared shell
 * strings (confirm / cancel / password ...) stay in `@/constants/texts`.
 */
import { PASSWORD_MIN_LENGTH } from '@shared/constants';
import type { AppSettings, ExportFormat } from '@shared/types';
import { tr } from '@/i18n/runtime';
import { formatBytes, formatMinutes } from '@/utils/format';

/** Catalogue key of every theme label. */
const THEME_KEYS: Record<AppSettings['theme'], string> = {
  system: 'settings.display.themeOption.system',
  light: 'settings.display.themeOption.light',
  dark: 'settings.display.themeOption.dark',
  'high-contrast': 'settings.display.themeOption.highContrast',
};

/** Named text-size presets (see FONT_SCALE_PRESETS in DisplaySection). */
export type FontScaleSize = 'small' | 'normal' | 'large' | 'veryLarge' | 'huge';

const FONT_SCALE_KEYS: Record<FontScaleSize, string> = {
  small: 'settings.display.fontScaleOption.small',
  normal: 'settings.display.fontScaleOption.normal',
  large: 'settings.display.fontScaleOption.large',
  veryLarge: 'settings.display.fontScaleOption.veryLarge',
  huge: 'settings.display.fontScaleOption.huge',
};

/** Number of days of sample data the server creates (settings.data.seedDemoMessage). */
export const DEMO_DAYS = 120;

export const ST = {
  // Page titles ---------------------------------------------------------------
  get settingsTitle() {
    return tr('settings.title');
  },
  get backupTitle() {
    return tr('settings.backup.pageTitle');
  },

  // Anonymous visitors --------------------------------------------------------
  get anonymousAccountText() {
    return tr('settings.account.anonymousText');
  },

  // Account -------------------------------------------------------------------
  get account() {
    return tr('settings.account.title');
  },
  /** Visible label of the small button next to a missing e-mail address. */
  get setEmail() {
    return tr('settings.account.setEmail');
  },
  /** Title of the set-e-mail dialog (also the accessible name of the "Set" button). */
  get setEmailTitle() {
    return tr('settings.account.setEmailTitle');
  },
  get emailSaved() {
    return tr('settings.account.emailSaved');
  },
  get editDetails() {
    return tr('settings.account.editDetails');
  },
  get editDetailsHint() {
    return tr('settings.account.editDetailsHint');
  },
  /** Label of the account-password field that confirms a new e-mail address. */
  get emailPassword() {
    return tr('settings.account.emailPassword');
  },
  get emailPasswordHint() {
    return tr('settings.account.emailPasswordHint');
  },
  get profileSaved() {
    return tr('settings.account.profileSaved');
  },
  get noChanges() {
    return tr('settings.account.noChanges');
  },
  get changePassword() {
    return tr('settings.account.changePassword');
  },
  get logoutAction() {
    return tr('settings.account.logout');
  },
  get logoutQuestion() {
    return tr('settings.account.logoutQuestion');
  },
  get oldPassword() {
    return tr('settings.account.oldPassword');
  },
  get newPassword() {
    return tr('settings.account.newPassword');
  },
  get confirmNewPassword() {
    return tr('settings.account.confirmNewPassword');
  },
  get newPasswordHint() {
    return tr('settings.account.newPasswordHint', { min: PASSWORD_MIN_LENGTH });
  },
  get passwordChanged() {
    return tr('settings.account.passwordChanged');
  },
  get wrongOldPassword() {
    return tr('settings.account.wrongOldPassword');
  },
  get passwordChangeHint() {
    return tr('settings.account.passwordChangeHint');
  },
  /** Account ID row (Your Personal Diary server only): the term, the copy button's name, its results and the hint. */
  get accountId() {
    return tr('settings.account.accountId');
  },
  get copyAccountId() {
    return tr('settings.account.copyAccountId');
  },
  get accountIdCopied() {
    return tr('settings.account.accountIdCopied');
  },
  get accountIdCopyFailed() {
    return tr('settings.account.accountIdCopyFailed');
  },
  get accountIdHint() {
    return tr('settings.account.accountIdHint');
  },

  // Sessions ------------------------------------------------------------------
  get devices() {
    return tr('settings.devices.title');
  },
  get devicesHint() {
    return tr('settings.devices.hint');
  },
  get currentDevice() {
    return tr('settings.devices.current');
  },
  get remembered() {
    return tr('settings.devices.remembered');
  },
  get unknownDevice() {
    return tr('settings.devices.unknown');
  },
  get connectedAt() {
    return tr('settings.devices.connectedAt');
  },
  get lastSeen() {
    return tr('settings.devices.lastSeen');
  },
  get revoke() {
    return tr('settings.devices.revoke');
  },
  revokeName: (device: string) => tr('settings.devices.revokeName', { device }),
  get noDevices() {
    return tr('settings.devices.none');
  },
  deviceRevoked: (device: string) => tr('settings.devices.revoked', { device }),

  // Display -------------------------------------------------------------------
  get display() {
    return tr('settings.display.title');
  },
  get theme() {
    return tr('settings.display.theme');
  },
  /** Label of a theme choice ("Dark", "Follow the system"...). */
  themeLabel: (theme: AppSettings['theme']) => tr(THEME_KEYS[theme]),
  themeChanged: (label: string) => tr('settings.display.themeChanged', { label }),
  get fontScale() {
    return tr('settings.display.fontScale');
  },
  /** Label of a text-size preset: ("small", 90) -> "Small (90%)". */
  fontScaleOption: (size: FontScaleSize, percent: number) => tr(FONT_SCALE_KEYS[size], { percent }),
  fontScaleChanged: (label: string) => tr('settings.display.fontScaleChanged', { label }),
  customScale: (percent: number) => tr('settings.display.fontScaleOption.custom', { percent }),
  get reduceMotion() {
    return tr('settings.display.reduceMotion');
  },
  get reduceMotionHint() {
    return tr('settings.display.reduceMotionHint');
  },
  get reduceMotionOn() {
    return tr('settings.display.reduceMotionOn');
  },
  get reduceMotionOff() {
    return tr('settings.display.reduceMotionOff');
  },
  get firstDayOfWeek() {
    return tr('settings.display.firstDayOfWeek');
  },
  get sunday() {
    return tr('settings.display.sunday');
  },
  get monday() {
    return tr('settings.display.monday');
  },
  firstDayChanged: (label: string) => tr('settings.display.firstDayChanged', { label }),
  get displayAnonymousHint() {
    return tr('settings.display.anonymousHint');
  },

  // Security ------------------------------------------------------------------
  get security() {
    return tr('settings.security.title');
  },
  get autoLock() {
    return tr('settings.security.autoLock');
  },
  get autoLockHint() {
    return tr('settings.security.autoLockHint');
  },
  get autoLockOff() {
    return tr('settings.security.autoLockOff');
  },
  /** Auto-lock delay label: 1 -> "1 minute", 5 -> "5 minutes", 60 -> "1 hour" (shell.format.* plurals). */
  minutes: (n: number) => formatMinutes(n),
  get oneMinute() {
    return formatMinutes(1);
  },
  get oneHour() {
    return formatMinutes(60);
  },
  autoLockChanged: (label: string) => tr('settings.security.autoLockChanged', { label }),
  get lockNow() {
    return tr('settings.security.lockNow');
  },
  get lockNowHint() {
    return tr('settings.security.lockNowHint');
  },

  // Reminders -----------------------------------------------------------------
  get reminders() {
    return tr('settings.reminders.title');
  },
  get remindersEnabled() {
    return tr('settings.reminders.enabled');
  },
  get remindersHint() {
    return tr('settings.reminders.hint');
  },
  get remindersExplanation() {
    return tr('settings.reminders.explanation');
  },
  get remindersOn() {
    return tr('settings.reminders.on');
  },
  get remindersOff() {
    return tr('settings.reminders.off');
  },
  get habitsLink() {
    return tr('settings.reminders.habitsLink');
  },

  // Data ----------------------------------------------------------------------
  get data() {
    return tr('settings.data.title');
  },
  /** The one-sentence reassurance at the top of the privacy card. */
  get dataReassurance() {
    return tr('settings.data.reassurance');
  },

  // Privacy (replaces the former Privacy page) ---------------------------------
  get privacy() {
    return tr('settings.privacy.title');
  },
  get offlineLabel() {
    return tr('settings.privacy.offlineLabel');
  },
  get offlineHint() {
    return tr('settings.privacy.offlineHint');
  },
  get offlineOn() {
    return tr('settings.privacy.offlineOn');
  },
  get offlineOff() {
    return tr('settings.privacy.offlineOff');
  },
  /** Text of the link to the privacy policy page of the diary server (PrivacyPolicyLink). */
  get privacyPolicyLink() {
    return tr('settings.privacy.policyLink');
  },

  // Your Personal Diary server (the published apps, the web UI it serves) -----------
  /** The reassurance of the privacy card there: stored on the server, encrypted with the password. */
  get hostedReassurance() {
    return tr('settings.hosted.reassurance');
  },
  /** The server's address, read-only ("Diary server: <host>"). */
  serverAddress: (host: string) => tr('settings.hosted.serverAddress', { host }),
  /** The offline switch's hint there (the one connection is the diary server, not a local one). */
  get offlineHintServer() {
    return tr('settings.hosted.offlineHint');
  },
  get seedDemo() {
    return tr('settings.data.seedDemo');
  },
  get seedDemoTitle() {
    return tr('settings.data.seedDemoTitle');
  },
  get seedDemoMessage() {
    return tr('settings.data.seedDemoMessage', { days: DEMO_DAYS });
  },
  get seedDemoConfirm() {
    return tr('settings.data.seedDemoConfirm');
  },
  seedDemoDone: (entries: number, habits: number, logs: number) => tr('settings.data.seedDemoDone', { entries, habits, logs }),

  // Delete account (the last card of the page) ----------------------------------
  get deleteAccountTitle() {
    return tr('settings.deleteAccount.title');
  },
  get deleteAccountWarning() {
    return tr('settings.deleteAccount.warning');
  },
  get deleteAccountButton() {
    return tr('settings.deleteAccount.button');
  },
  /** Dialog title naming the account ('Delete the account "dana"?'). */
  deleteAccountDialogTitle: (username: string) => tr('settings.deleteAccount.dialogTitle', { username }),
  get deleteAccountPasswordHint() {
    return tr('settings.deleteAccount.passwordHint');
  },
  get deleteAccountUnderstand() {
    return tr('settings.deleteAccount.understand');
  },
  get deleteAccountConfirm() {
    return tr('settings.deleteAccount.confirm');
  },
  get deleteAccountDone() {
    return tr('settings.deleteAccount.done');
  },
  get deleteAccountWrongPassword() {
    return tr('settings.deleteAccount.wrongPassword');
  },
  /** What deleting the owner's account does to remote access (server: RemoteManager.releaseOwner). */
  get deleteAccountOwnerRemote() {
    return tr('settings.deleteAccount.ownerRemote');
  },
  /** ...to the mail settings (server: MailService.releaseOwner). */
  get deleteAccountOwnerMail() {
    return tr('settings.deleteAccount.ownerMail');
  },
  /** ...to both. */
  get deleteAccountOwnerBoth() {
    return tr('settings.deleteAccount.ownerBoth');
  },
  /**
   * The owner of the Your Personal Diary server (hosted mode): the mail settings are erased, nobody is
   * promoted, and the Server card is off until DIARY_OWNER_ID names an account again (server/src/hosted/owner.ts).
   */
  get deleteAccountOwnerHosted() {
    return tr('settings.deleteAccount.ownerHosted');
  },

  // Diagnostics ---------------------------------------------------------------
  get diagnostics() {
    return tr('settings.diagnostics.title');
  },
  get diagnosticsHint() {
    return tr('settings.diagnostics.hint');
  },
  get uiVersion() {
    return tr('settings.diagnostics.uiVersion');
  },
  get serverVersion() {
    return tr('settings.diagnostics.serverVersion');
  },
  get serverPort() {
    return tr('settings.diagnostics.port');
  },
  get lanStatus() {
    return tr('settings.diagnostics.lanStatus');
  },
  get lanOn() {
    return tr('settings.diagnostics.lanOn');
  },
  get lanOff() {
    return tr('settings.diagnostics.lanOff');
  },
  get startedAt() {
    return tr('settings.diagnostics.startedAt');
  },
  get showServerLog() {
    return tr('settings.diagnostics.showServerLog');
  },
  get hideServerLog() {
    return tr('settings.diagnostics.hideServerLog');
  },
  get serverLog() {
    return tr('settings.diagnostics.serverLog');
  },
  get serverLogEmpty() {
    return tr('settings.diagnostics.serverLogEmpty');
  },
  serverLogLoaded: (lines: number) => tr('settings.diagnostics.serverLogLoaded', { count: lines }),
  get serverLogFailed() {
    return tr('settings.diagnostics.serverLogFailed');
  },
  get restartServer() {
    return tr('settings.diagnostics.restartServer');
  },
  get restartTitle() {
    return tr('settings.diagnostics.restartTitle');
  },
  get restartMessage() {
    return tr('settings.diagnostics.restartMessage');
  },
  get restartConfirm() {
    return tr('settings.diagnostics.restartConfirm');
  },
  get restarting() {
    return tr('settings.diagnostics.restarting');
  },
  get restartFailed() {
    return tr('settings.diagnostics.restartFailed');
  },

  // Data: phone access on the home network (desktop only) ----------------------
  get lanAccess() {
    return tr('settings.lan.title');
  },
  get lanAccessLabel() {
    return tr('settings.lan.label');
  },
  get lanAccessHint() {
    return tr('settings.lan.hint');
  },
  get lanOnlyFromComputer() {
    return tr('settings.lan.onlyFromComputer');
  },
  get lanEnabledMsg() {
    return tr('settings.lan.enabled');
  },
  /** Shown to every account but the owner of this computer (who alone can switch phone access). */
  get lanOwnerOnly() {
    return tr('settings.lan.ownerOnly');
  },
  get lanStatusOn() {
    return tr('settings.lan.statusOn');
  },
  get lanStatusOff() {
    return tr('settings.lan.statusOff');
  },
  get lanConfirmTitle() {
    return tr('settings.lan.confirmTitle');
  },
  get lanConfirmMessage() {
    return tr('settings.lan.confirmMessage');
  },
  get lanDisabledMsg() {
    return tr('settings.lan.disabled');
  },
  get lanUrlsTitle() {
    return tr('settings.lan.urlsTitle');
  },
  get lanNoUrls() {
    return tr('settings.lan.noUrls');
  },
  get copy() {
    return tr('settings.lan.copy');
  },
  copyName: (url: string) => tr('settings.lan.copyName', { url }),
  copied: (url: string) => tr('settings.lan.copied', { url }),
  get copyFailed() {
    return tr('settings.lan.copyFailed');
  },
  get lanInstructionsTitle() {
    return tr('settings.lan.instructionsTitle');
  },
  /** The numbered connection steps, in display order. */
  get lanInstructions(): string[] {
    return [
      tr('settings.lan.instructions.sameNetwork'),
      tr('settings.lan.instructions.openUrl'),
      tr('settings.lan.instructions.firewall'),
      tr('settings.lan.instructions.sameServer'),
    ];
  },

  // Backup --------------------------------------------------------------------
  get backup() {
    return tr('settings.backup.title');
  },
  get backupExplanation() {
    return tr('settings.backup.explanation');
  },
  get backupOwnPassword() {
    return tr('settings.backup.ownPassword');
  },
  get backupOwnPasswordHint() {
    return tr('settings.backup.ownPasswordHint');
  },
  get backupPassword() {
    return tr('settings.backup.password');
  },
  get backupPasswordConfirm() {
    return tr('settings.backup.passwordConfirm');
  },
  get createBackup() {
    return tr('settings.backup.create');
  },
  get backupFilter() {
    return tr('settings.backup.fileFilter');
  },
  backupCreated: (fileName: string, bytes: number) => tr('settings.backup.created', { fileName, size: formatBytes(bytes) }),
  get cancelled() {
    return tr('settings.actionCancelled');
  },

  // Restore -------------------------------------------------------------------
  get restore() {
    return tr('settings.restore.title');
  },
  get restoreExplanation() {
    return tr('settings.restore.explanation');
  },
  get pickBackupFile() {
    return tr('settings.restore.pickFile');
  },
  get backupFileField() {
    return tr('settings.restore.fileField');
  },
  get backupFileHint() {
    return tr('settings.restore.fileHint');
  },
  get chosenFile() {
    return tr('settings.restore.chosenFile');
  },
  get fileSize() {
    return tr('settings.restore.fileSize');
  },
  get fileStatus() {
    return tr('settings.restore.fileStatus');
  },
  get inspecting() {
    return tr('settings.restore.inspecting');
  },
  get restoreAction() {
    return tr('settings.restore.action');
  },
  get restoreTitle() {
    return tr('settings.restore.confirmTitle');
  },
  get restoreWarning() {
    return tr('settings.restore.warning');
  },
  get restoreConfirm() {
    return tr('settings.restore.confirm');
  },
  restored: (entries: number, habits: number) => tr('settings.restore.done', { entries, habits }),
  get needBackupFile() {
    return tr('settings.restore.needFile');
  },
  get invalidBackupFile() {
    return tr('settings.restore.invalidFile');
  },

  // Export --------------------------------------------------------------------
  get exportSection() {
    return tr('settings.export.title');
  },
  get exportExplanation() {
    return tr('settings.export.explanation');
  },
  get exportFormat() {
    return tr('settings.export.format');
  },
  /** Radio label of an export format: 'csv' -> "CSV - table". */
  exportFormatLabel: (format: ExportFormat) => tr(`settings.export.formatOption.${format}`),
  /** Radio hint of an export format. */
  exportFormatHint: (format: ExportFormat) => tr(`settings.export.formatHint.${format}`),
  /** Native save-dialog filter name of an export format: 'pdf' -> "PDF document". */
  exportFilterName: (format: ExportFormat) => tr(`settings.export.filter.${format}`),
  get exportFrom() {
    return tr('settings.export.from');
  },
  get exportTo() {
    return tr('settings.export.to');
  },
  get exportRangeHint() {
    return tr('settings.export.rangeHint');
  },
  get exportRangeError() {
    return tr('settings.export.rangeError');
  },
  get includeHabits() {
    return tr('settings.export.includeHabits');
  },
  /** Hint under the (disabled) habits checkbox while CSV is selected - the CSV has no habits table. */
  get includeHabitsCsv() {
    return tr('settings.export.includeHabitsCsv');
  },
  get exportAction() {
    return tr('settings.export.action');
  },
  exportDone: (entries: number) => tr('settings.export.done', { count: entries }),
  /** Completion message that also names the written file (desktop and header-reported downloads). */
  exportDoneWithFile: (entries: number, fileName: string) => tr('settings.export.doneWithFile', { count: entries, fileName }),
  exportDownloaded: (fileName: string) => tr('settings.export.downloaded', { fileName }),
};
