/**
 * Strings of the Remote access card (catalogue keys 'settings.remote.*' in
 * shared/i18n/messages/<locale>/settings.ts), resolved in the current UI
 * language. Like `ST`, every member is a getter or a function so call sites
 * read the live language. The step / check messages themselves come from the
 * server as catalogue keys ('server.remote.*') and are rendered by `remoteMessage`.
 */
import type { RemoteCheckState, RemoteCheckId, RemoteMessage, RemoteStepId, RemoteStepState } from '@shared/types';
import { tr } from '@/i18n/runtime';
import { formatLongDate } from '@/utils/dates';

/** Prefix of the details the server sends as catalogue keys (remote/errors.ts errorDetail). */
const DETAIL_KEY_PREFIX = 'server.remote.detail.';
/** A plain YYYY-MM-DD message parameter (certificate dates). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The owner's DuckDNS name, prefilled until another one is saved. */
export const DEFAULT_REMOTE_HOSTNAME = 'yourpersonaldiary.duckdns.org';

export const RT = {
  get title() {
    return tr('settings.remote.title');
  },
  get intro() {
    return tr('settings.remote.intro');
  },
  get switchLabel() {
    return tr('settings.remote.switchLabel');
  },
  get switchHint() {
    return tr('settings.remote.switchHint');
  },
  get enabled() {
    return tr('settings.remote.enabled');
  },
  get disabled() {
    return tr('settings.remote.disabled');
  },
  get offlineTurnedOff() {
    return tr('settings.remote.offlineTurnedOff');
  },
  get detailsTitle() {
    return tr('settings.remote.detailsTitle');
  },
  get hostname() {
    return tr('settings.remote.hostname');
  },
  get hostnameHint() {
    return tr('settings.remote.hostnameHint');
  },
  get hostnameInvalid() {
    return tr('settings.remote.hostnameInvalid');
  },
  get token() {
    return tr('settings.remote.token');
  },
  get tokenHint() {
    return tr('settings.remote.tokenHint');
  },
  get tokenSaved() {
    return tr('settings.remote.tokenSaved');
  },
  get tokenMissing() {
    return tr('settings.remote.tokenMissing');
  },
  get tokenInvalid() {
    return tr('settings.remote.tokenInvalid');
  },
  get showToken() {
    return tr('settings.remote.showToken');
  },
  get publicPort() {
    return tr('settings.remote.publicPort');
  },
  get publicPortHint() {
    return tr('settings.remote.publicPortHint');
  },
  get portInvalid() {
    return tr('settings.remote.portInvalid');
  },
  get upnp() {
    return tr('settings.remote.upnp');
  },
  get upnpHint() {
    return tr('settings.remote.upnpHint');
  },
  get save() {
    return tr('settings.remote.save');
  },
  get saved() {
    return tr('settings.remote.saved');
  },
  get test() {
    return tr('settings.remote.test');
  },
  get testTitle() {
    return tr('settings.remote.testTitle');
  },
  /** Ports and counts are passed as text so they are never grouped ("8,443"). */
  testDone: (passed: number, total: number) => tr('settings.remote.testDone', { passed: String(passed), total: String(total) }),
  get statusTitle() {
    return tr('settings.remote.statusTitle');
  },
  get busy() {
    return tr('settings.remote.busy');
  },
  ready: (url: string) => tr('settings.remote.ready', { url }),
  failed: (message: string) => tr('settings.remote.failed', { message }),
  lastError: (message: string) => tr('settings.remote.lastError', { message }),
  nextRetry: (time: string) => tr('settings.remote.nextRetry', { time }),
  stepAt: (time: string) => tr('settings.remote.stepAt', { time }),
  stateLabel: (state: RemoteStepState | RemoteCheckState) => tr(`settings.remote.state.${state}`),
  stepName: (id: RemoteStepId) => tr(`settings.remote.step.${id}`),
  checkName: (id: RemoteCheckId) => tr(`settings.remote.check.${id}`),
  get publicIp() {
    return tr('settings.remote.publicIp');
  },
  get unknown() {
    return tr('settings.remote.unknown');
  },
  get certificate() {
    return tr('settings.remote.certificate');
  },
  certificateValid: (date: string, days: number, issuer: string) => tr('settings.remote.certificateValid', { date, days, issuer }),
  get certificateStaging() {
    return tr('settings.remote.certificateStaging');
  },
  get noCertificate() {
    return tr('settings.remote.noCertificate');
  },
  get renew() {
    return tr('settings.remote.renew');
  },
  get renewStarted() {
    return tr('settings.remote.renewStarted');
  },
  get urlTitle() {
    return tr('settings.remote.urlTitle');
  },
  get urlHint() {
    return tr('settings.remote.urlHint');
  },
  get noUrl() {
    return tr('settings.remote.noUrl');
  },
  qrLabel: (url: string) => tr('settings.remote.qrLabel', { url }),
  get qrHint() {
    return tr('settings.remote.qrHint');
  },
  get instructionsTitle() {
    return tr('settings.remote.instructionsTitle');
  },
  /** The numbered instructions; the port-forwarding step names this computer's LAN address when known. */
  instructions: (publicPort: number, port: number, ip: string | null): string[] => [
    tr('settings.remote.instructions.account'),
    tr('settings.remote.instructions.enter'),
    tr('settings.remote.instructions.firstCertificate'),
    tr('settings.remote.instructions.keepOn'),
    ip
      ? tr('settings.remote.instructions.manualForward', { publicPort: String(publicPort), ip, port: String(port) })
      : tr('settings.remote.instructions.manualForwardNoIp', { publicPort: String(publicPort), port: String(port) }),
    tr('settings.remote.instructions.firewall'),
    tr('settings.remote.instructions.signIn'),
    tr('settings.remote.instructions.atHome'),
  ],
  get privacyNote() {
    return tr('settings.remote.privacyNote');
  },
  get offlineConflictTitle() {
    return tr('settings.remote.offlineConflictTitle');
  },
  get offlineConflictMessage() {
    return tr('settings.remote.offlineConflictMessage');
  },
  get offlineConflictConfirm() {
    return tr('settings.remote.offlineConflictConfirm');
  },
  get disabledByOffline() {
    return tr('settings.remote.disabledByOffline');
  },
  get offlineConflictPassword() {
    return tr('settings.remote.offlineConflictPassword');
  },
  // Ownership and the locked card ---------------------------------------------------------------
  get ownerNote() {
    return tr('settings.remote.ownerNote');
  },
  get setupOwnerNote() {
    return tr('settings.remote.setupOwnerNote');
  },
  get currentTitle() {
    return tr('settings.remote.currentTitle');
  },
  get summaryState() {
    return tr('settings.remote.summary.state');
  },
  get summaryOn() {
    return tr('settings.remote.summary.on');
  },
  get summaryOff() {
    return tr('settings.remote.summary.off');
  },
  get summaryTokenSaved() {
    return tr('settings.remote.summary.tokenSaved');
  },
  get summaryUpnp() {
    return tr('settings.remote.summary.upnp');
  },
  get summaryUpnpAuto() {
    return tr('settings.remote.summary.upnpAuto');
  },
  get summaryUpnpManual() {
    return tr('settings.remote.summary.upnpManual');
  },
  get lockedHint() {
    return tr('settings.remote.lockedHint');
  },
  get change() {
    return tr('settings.remote.change');
  },
  get unlockTitle() {
    return tr('settings.remote.unlockTitle');
  },
  get unlockMessage() {
    return tr('settings.remote.unlockMessage');
  },
  get unlocked() {
    return tr('settings.remote.unlocked');
  },
  get editCancelled() {
    return tr('settings.remote.editCancelled');
  },
  get savedLocked() {
    return tr('settings.remote.savedLocked');
  },
  get password() {
    return tr('settings.remote.password');
  },
  get passwordHint() {
    return tr('settings.remote.passwordHint');
  },
  get passwordMissing() {
    return tr('settings.remote.passwordMissing');
  },
  get wrongPassword() {
    return tr('settings.remote.wrongPassword');
  },
};

/**
 * Text of a message the server reported as a catalogue key + parameters, in the
 * UI language; `fallback` when the key is unknown to this build of the UI. A plain YYYY-MM-DD
 * parameter (the certificate's expiry date) is shown as a date in the UI language.
 */
export function remoteMessage(message: RemoteMessage | null | undefined, fallback: string): string {
  if (!message || !message.messageKey) return fallback;
  const params: Record<string, string | number> = { ...(message.params ?? {}) };
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === 'string' && ISO_DATE.test(value)) params[name] = formatLongDate(value);
  }
  // A detail the server wrote as a catalogue key (a timeout, an unreadable answer) - in this language.
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.startsWith(DETAIL_KEY_PREFIX)) {
      const text = tr(value, params);
      if (text !== value) params[name] = text;
    }
  }
  const text = tr(message.messageKey, params);
  return text === message.messageKey ? fallback : text;
}
