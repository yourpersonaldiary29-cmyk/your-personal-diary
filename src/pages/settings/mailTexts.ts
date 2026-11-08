/**
 * Strings of the "E-mail for password reset" card (catalogue keys
 * 'settings.mail.*' in shared/i18n/messages/<locale>/settings.ts), resolved in
 * the current UI language. Like `ST` / `RT`, every member is a getter or a
 * function so call sites always read the live language.
 */
import type { MailSecurity } from '@shared/types';
import { tr } from '@/i18n/runtime';

/** The Gmail address the owner created for the diary, prefilled until another one is saved. */
export const DEFAULT_MAIL_ADDRESS = 'yourpersonaldiary29@gmail.com';
/** Gmail's SMTP server and its implicit-TLS port (the server's defaults too). */
export const DEFAULT_MAIL_HOST = 'smtp.gmail.com';
export const DEFAULT_MAIL_PORT = 465;
/** The usual port of each connection security. */
export const MAIL_SECURITY_PORTS: Record<MailSecurity, number> = { tls: 465, starttls: 587 };
/** Protocol names in the summary line (technical names, the same in every language). */
export const MAIL_SECURITY_NAMES: Record<MailSecurity, string> = { tls: 'SSL/TLS', starttls: 'STARTTLS' };

export const MT = {
  get title() {
    return tr('settings.mail.title');
  },
  get intro() {
    return tr('settings.mail.intro');
  },
  get ownerNote() {
    return tr('settings.mail.ownerNote');
  },
  get setupOwnerNote() {
    return tr('settings.mail.setupOwnerNote');
  },
  get switchLabel() {
    return tr('settings.mail.switchLabel');
  },
  get switchHint() {
    return tr('settings.mail.switchHint');
  },
  get detailsTitle() {
    return tr('settings.mail.detailsTitle');
  },
  get address() {
    return tr('settings.mail.address');
  },
  get addressHint() {
    return tr('settings.mail.addressHint');
  },
  get addressInvalid() {
    return tr('settings.mail.addressInvalid');
  },
  get appPassword() {
    return tr('settings.mail.appPassword');
  },
  get appPasswordHint() {
    return tr('settings.mail.appPasswordHint');
  },
  get appPasswordSaved() {
    return tr('settings.mail.appPasswordSaved');
  },
  get appPasswordMissing() {
    return tr('settings.mail.appPasswordMissing');
  },
  get appPasswordGmail() {
    return tr('settings.mail.appPasswordGmail');
  },
  get advanced() {
    return tr('settings.mail.advanced');
  },
  get host() {
    return tr('settings.mail.host');
  },
  get hostHint() {
    return tr('settings.mail.hostHint');
  },
  get hostInvalid() {
    return tr('settings.mail.hostInvalid');
  },
  get port() {
    return tr('settings.mail.port');
  },
  get portHint() {
    return tr('settings.mail.portHint');
  },
  get portInvalid() {
    return tr('settings.mail.portInvalid');
  },
  get security() {
    return tr('settings.mail.security');
  },
  securityLabel: (security: MailSecurity) => tr(`settings.mail.security.${security}`),
  get password() {
    return tr('settings.mail.password');
  },
  get passwordHint() {
    return tr('settings.mail.passwordHint');
  },
  get passwordMissing() {
    return tr('settings.mail.passwordMissing');
  },
  get wrongPassword() {
    return tr('settings.mail.wrongPassword');
  },
  get saved() {
    return tr('settings.mail.saved');
  },
  get savedLocked() {
    return tr('settings.mail.savedLocked');
  },
  get enabled() {
    return tr('settings.mail.enabled');
  },
  get disabled() {
    return tr('settings.mail.disabled');
  },
  get notReady() {
    return tr('settings.mail.notReady');
  },
  get currentTitle() {
    return tr('settings.mail.currentTitle');
  },
  get summaryState() {
    return tr('settings.mail.summary.state');
  },
  get summaryOn() {
    return tr('settings.mail.summary.on');
  },
  get summaryOff() {
    return tr('settings.mail.summary.off');
  },
  get summaryAddress() {
    return tr('settings.mail.summary.address');
  },
  get summaryAppPassword() {
    return tr('settings.mail.summary.appPassword');
  },
  get summaryAppPasswordSaved() {
    return tr('settings.mail.summary.appPasswordSaved');
  },
  get summaryServer() {
    return tr('settings.mail.summary.server');
  },
  /** "smtp.gmail.com, port 465, SSL/TLS" - the port as plain digits (never grouped). */
  serverValue: (host: string, port: number, security: MailSecurity) =>
    tr('settings.mail.summary.serverValue', { host, port: String(port), security: MAIL_SECURITY_NAMES[security] ?? security }),
  get lockedHint() {
    return tr('settings.mail.lockedHint');
  },
  get change() {
    return tr('settings.mail.change');
  },
  get unlockTitle() {
    return tr('settings.mail.unlockTitle');
  },
  get unlockMessage() {
    return tr('settings.mail.unlockMessage');
  },
  get unlocked() {
    return tr('settings.mail.unlocked');
  },
  get editCancelled() {
    return tr('settings.mail.editCancelled');
  },
  get test() {
    return tr('settings.mail.test');
  },
  testHint: (email: string) => tr('settings.mail.testHint', { email }),
  get testNoEmail() {
    return tr('settings.mail.testNoEmail');
  },
  testSent: (email: string) => tr('settings.mail.testSent', { email }),
  testFailed: (message: string) => tr('settings.mail.testFailed', { message }),
  get instructionsTitle() {
    return tr('settings.mail.instructionsTitle');
  },
  /** The steps to create a Gmail App Password, in order. */
  instructions: (): string[] =>
    ['signIn', 'twoStep', 'create', 'copy', 'test'].map((step) => tr(`settings.mail.instructions.${step}`)),
  get whyAppPassword() {
    return tr('settings.mail.whyAppPassword');
  },
  get privacyNote() {
    return tr('settings.mail.privacyNote');
  },
};
