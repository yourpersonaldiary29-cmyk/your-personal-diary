/**
 * UI strings of the application shell and the auth pages, in the current
 * language. Every value is a getter (or a function when the text takes
 * parameters) over the catalogue keys 'shell.*' / 'auth.*' found in
 * shared/i18n/messages/<locale>/{shell,auth}.ts, so call sites keep reading
 * `T.save` / `T.greeting(name)` and always get the current language (App.tsx
 * re-keys its subtree on a language change, so every getter is read again).
 * Feature pages define their own text objects; everything shared (buttons,
 * messages, labels) lives here so wording stays consistent.
 */
import { APP_NAME } from '@shared/constants';
import { tr } from '@/i18n/runtime';

export const T = {
  /** The brand name - always English (APP_NAME), whatever the UI language. */
  get appName() {
    return APP_NAME;
  },
  get privacySentence() {
    return tr('shell.privacySentence');
  },
  /**
   * The privacy line of the Welcome page and the footer. With the Your Personal Diary server (the apps,
   * and the web UI it serves) it says where the diary is and that it is encrypted with the password -
   * never "end to end": the server decrypts it while you are signed in (docs/HOSTED-PLAN.md section 6).
   */
  privacySentenceFor: (hostedServer: boolean): string => tr(hostedServer ? 'shell.privacySentenceServer' : 'shell.privacySentence'),
  get underConstruction() {
    return tr('shell.underConstruction');
  },

  // Shell
  get skipToContent() {
    return tr('shell.skipToContent');
  },
  get mainNavLabel() {
    return tr('shell.mainNavLabel');
  },
  get menu() {
    return tr('shell.menu');
  },
  get back() {
    return tr('shell.back');
  },
  get noPreviousPage() {
    return tr('shell.noPreviousPage');
  },
  get home() {
    return tr('shell.route.home');
  },
  get register() {
    return tr('shell.register');
  },
  get login() {
    return tr('shell.login');
  },
  get logout() {
    return tr('shell.logout');
  },
  get shortcuts() {
    return tr('shell.shortcuts');
  },
  /** Column headers of the keyboard-shortcuts tables. */
  get shortcutColumn() {
    return tr('shell.shortcuts.columnShortcut');
  },
  get actionColumn() {
    return tr('shell.shortcuts.columnAction');
  },
  get close() {
    return tr('shell.close');
  },
  get closeMessage() {
    return tr('shell.closeMessage');
  },
  get loading() {
    return tr('shell.loading');
  },
  get loadingSession() {
    return tr('shell.loadingSession');
  },
  greeting: (firstName: string) => tr('shell.greeting', { firstName }),
  greetingShort: (firstName: string) => tr('shell.greetingShort', { firstName }),
  /** document.title of a page: "Page - App name". */
  documentTitle: (page: string) => tr('shell.documentTitle', { page, app: tr('shell.appName') }),
  version: (version: string) => tr('shell.version', { version }),
  /** One-line privacy reassurance shown in the footer. */
  get footerPrivacy() {
    return tr('shell.footer.privacy');
  },
  /** The footer line; with the Your Personal Diary server the server wording (see `privacySentenceFor`). */
  footerPrivacyFor: (hostedServer: boolean): string => (hostedServer ? tr('shell.privacySentenceServer') : tr('shell.footer.privacy')),
  /** Accessible name of the toast region. */
  get toastRegion() {
    return tr('shell.toastRegion');
  },

  // Generic actions
  get save() {
    return tr('shell.save');
  },
  get cancel() {
    return tr('shell.cancel');
  },
  get confirm() {
    return tr('shell.confirm');
  },
  get delete() {
    return tr('shell.delete');
  },
  get edit() {
    return tr('shell.edit');
  },
  get retry() {
    return tr('shell.retry');
  },
  get required() {
    return tr('shell.required');
  },
  get notReported() {
    return tr('shell.format.notReported');
  },
  get showAsTable() {
    return tr('shell.showAsTable');
  },
  get hideTable() {
    return tr('shell.hideTable');
  },
  get showPassword() {
    return tr('shell.showPassword');
  },
  get hidePassword() {
    return tr('shell.hidePassword');
  },

  // Auth forms
  get firstName() {
    return tr('auth.firstName');
  },
  get lastName() {
    return tr('auth.lastName');
  },
  get username() {
    return tr('auth.username');
  },
  get email() {
    return tr('auth.email');
  },
  get emailHint() {
    return tr('auth.emailHint');
  },
  get emailInvalid() {
    return tr('auth.emailInvalid');
  },
  get emailTaken() {
    return tr('auth.emailTaken');
  },
  get usernameTaken() {
    return tr('auth.usernameTaken');
  },
  get emailNotSet() {
    return tr('auth.emailNotSet');
  },
  get usernameOrEmail() {
    return tr('auth.usernameOrEmail');
  },
  get password() {
    return tr('auth.password');
  },
  get confirmPassword() {
    return tr('auth.confirmPassword');
  },
  get rememberMe() {
    return tr('auth.rememberMe');
  },
  get rememberMeHint() {
    return tr('auth.rememberMeHint');
  },
  get usernameHint() {
    return tr('auth.usernameHint');
  },
  /** Password rule hint; `min` is PASSWORD_MIN_LENGTH. */
  passwordHint: (min: number) => tr('auth.passwordHint', { min }),
  get registeredAccounts() {
    return tr('auth.registeredAccounts');
  },
  get registeredAccountsHint() {
    return tr('auth.registeredAccountsHint');
  },
  accountOption: (firstName: string, lastName: string, username: string) =>
    tr('auth.accountOption', { name: [firstName, lastName].filter(Boolean).join(' '), username }),
  get accountSelected() {
    return tr('auth.accountSelected');
  },
  accountFilled: (username: string) => tr('auth.accountFilled', { username }),
  get createAccount() {
    return tr('auth.createAccount');
  },
  get registerTitle() {
    return tr('auth.registerTitle');
  },
  get loginTitle() {
    return tr('auth.loginTitle');
  },
  get noAccountYet() {
    return tr('auth.noAccountYet');
  },
  get alreadyHaveAccount() {
    return tr('auth.alreadyHaveAccount');
  },
  /** The error under the unticked privacy checkbox of the registration form. */
  get privacyConsentRequired() {
    return tr('auth.privacyConsentRequired');
  },
  fieldRequired: (label: string) => tr('shell.fieldRequired', { label }),
  get passwordsMismatch() {
    return tr('auth.passwordsMismatch');
  },
  get loginRequired() {
    return tr('auth.loginRequired');
  },
  get sessionExpired() {
    return tr('auth.sessionExpired');
  },
  get sessionEnded() {
    return tr('auth.sessionEnded');
  },
  get loggedOut() {
    return tr('auth.loggedOut');
  },
  welcomeBack: (firstName: string) => tr('auth.welcomeBack', { firstName }),
  accountCreated: (firstName: string) => tr('auth.accountCreated', { firstName }),
  fixErrors: (count: number) => tr('shell.fixErrors', { count }),

  // Forgotten password (LoginPage link, ForgotPasswordPage, ResetPasswordPage)
  get forgotPasswordLink() {
    return tr('auth.forgotPasswordLink');
  },
  get forgotTitle() {
    return tr('auth.forgot.title');
  },
  get forgotIntro() {
    return tr('auth.forgot.intro');
  },
  get forgotEmail() {
    return tr('auth.forgot.email');
  },
  get forgotSubmit() {
    return tr('auth.forgot.submit');
  },
  get forgotSendAgain() {
    return tr('auth.forgot.sendAgain');
  },
  /** Client copy of the server's 'server.reset.sent' answer (used when the answer carries no message). */
  get forgotSent() {
    return tr('auth.forgot.sent');
  },
  get forgotSentNext() {
    return tr('auth.forgot.sentNext');
  },
  get forgotNotAvailable() {
    return tr('auth.forgot.notAvailable');
  },
  get forgotHaveCode() {
    return tr('auth.forgot.haveCode');
  },
  get backToLogin() {
    return tr('auth.forgot.backToLogin');
  },
  get resetTitle() {
    return tr('auth.reset.title');
  },
  get resetIntroLink() {
    return tr('auth.reset.introLink');
  },
  get resetIntroCode() {
    return tr('auth.reset.introCode');
  },
  get resetCode() {
    return tr('auth.reset.code');
  },
  get resetCodeHint() {
    return tr('auth.reset.codeHint');
  },
  get resetCodeInvalid() {
    return tr('auth.reset.codeInvalid');
  },
  get resetNewPassword() {
    return tr('auth.reset.newPassword');
  },
  get resetConfirmPassword() {
    return tr('auth.reset.confirmPassword');
  },
  get resetSubmit() {
    return tr('auth.reset.submit');
  },
  get resetDone() {
    return tr('auth.reset.done');
  },
  get resetUseCode() {
    return tr('auth.reset.useCode');
  },
  get resetRequestNew() {
    return tr('auth.reset.requestNew');
  },

  // Lock screen
  get lockTitle() {
    return tr('shell.lock.title');
  },
  get lockDescription() {
    return tr('shell.lock.description');
  },
  get unlock() {
    return tr('shell.lock.unlock');
  },
  get locked() {
    return tr('shell.lock.locked');
  },
  get unlocked() {
    return tr('shell.lock.unlocked');
  },
  get lockWrongPassword() {
    return tr('shell.lock.wrongPassword');
  },

  // Welcome page
  get welcomeTitle() {
    return tr('shell.welcome.title');
  },
  get welcomeLead() {
    return tr('shell.welcome.lead');
  },
  get welcomeFeaturesHeading() {
    return tr('shell.welcome.featuresHeading');
  },
  get welcomeFeatures(): string[] {
    return T.welcomeFeaturesFor(false);
  },
  /** The feature list; with the Your Personal Diary server the encryption line names the server, not "your computer". */
  welcomeFeaturesFor: (hostedServer: boolean): string[] => [
    tr('shell.welcome.feature.entries'),
    tr('shell.welcome.feature.habits'),
    tr('shell.welcome.feature.insights'),
    tr('shell.welcome.feature.search'),
    tr(hostedServer ? 'shell.welcome.feature.encryptionServer' : 'shell.welcome.feature.encryption'),
  ],

  // Errors
  get genericError() {
    return tr('shell.genericError');
  },
  get noServer() {
    return tr('shell.noServer');
  },
  get settingsLoadFailed() {
    return tr('shell.settingsLoadFailed');
  },
  get notFoundTitle() {
    return tr('shell.notFoundTitle');
  },
  get notFoundText() {
    return tr('shell.notFoundText');
  },
  get goHome() {
    return tr('shell.goHome');
  },

  // Reminders
  get reminderTitle() {
    return tr('shell.reminderTitle');
  },
};
