/** en - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'First name',
  'auth.lastName': 'Last name',
  'auth.username': 'Username',
  'auth.email': 'E-mail',
  'auth.emailHint': 'Used to log in and to reset a forgotten password',
  'auth.emailInvalid': 'The e-mail address is not valid',
  'auth.emailTaken': 'Error: This email address is already registered.',
  'auth.usernameTaken': 'Error: This username is already taken. Please choose another one.',
  'auth.emailNotSet': 'Not set',
  'auth.usernameOrEmail': 'Username or e-mail',
  'auth.password': 'Password',
  'auth.confirmPassword': 'Confirm password',
  'auth.rememberMe': 'Remember me',
  'auth.rememberMeHint': 'Sign in automatically next time on this device',
  'auth.usernameHint': 'Letters, digits, dot, hyphen or underscore (3 to 32 characters)',
  'auth.passwordHint': 'At least {min} characters, with letters and digits',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Accounts registered on this computer',
  'auth.registeredAccountsHint': 'Choosing a name fills in the username; only the password is left to enter.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'selected',
  'auth.accountFilled': 'The username {username} was filled in. Enter the password.',

  // Titles, buttons and links
  'auth.createAccount': 'Create account',
  'auth.registerTitle': 'Sign up',
  'auth.loginTitle': 'Log in',
  'auth.noAccountYet': "Don't have an account yet?",
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  'auth.legalConsent': 'I have read the {policy} and the {terms}, and I agree to them',
  'auth.privacyConsentLink': 'Privacy Policy',
  'auth.termsConsentLink': 'Terms of Use',
  'auth.legalConsentRequired': 'To create an account, tick this box to confirm that you have read the Privacy Policy and the Terms of Use and agree to them.',
  'auth.alreadyHaveAccount': 'Already have an account?',

  // Validation and session messages
  'auth.passwordsMismatch': 'The passwords do not match',
  'auth.loginRequired': 'Please log in first to continue to the requested page.',
  'auth.sessionExpired': 'Your session has expired. Please log in again.',
  'auth.sessionEnded': 'Your session has ended. Please log in again.',
  'auth.loggedOut': 'You have logged out of the diary.',
  'auth.welcomeBack': 'Hello {firstName}, you have logged in successfully.',
  'auth.accountCreated': 'Your account was created. Welcome, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Forgot password?',
  'auth.forgot.title': 'Forgot password',
  'auth.forgot.intro':
    'Enter the e-mail address you registered with. We will send you a link and a 6-digit code for choosing a new password. Your diary entries are kept.',
  'auth.forgot.email': 'E-mail address you registered with',
  'auth.forgot.submit': 'Send reset link',
  'auth.forgot.sendAgain': 'Send again',
  'auth.forgot.sent': 'If this address is registered, we sent a link and a code to it.',
  'auth.forgot.sentNext':
    'The link and the code are valid for 30 minutes and can be used once. If the e-mail does not arrive within a few minutes, check the spam folder.',
  'auth.forgot.notAvailable':
    'Password reset by e-mail is not set up on this diary yet. The account that owns this computer can set it up in Settings, in the "E-mail for password reset" card.',
  'auth.forgot.haveCode': 'Enter the code from the e-mail',
  'auth.forgot.backToLogin': 'Back to log in',
  'auth.reset.title': 'Reset password',
  'auth.reset.introLink':
    'Choose a new password for your account. Your diary entries are kept, and you will be signed out on every device.',
  'auth.reset.introCode':
    'Enter the e-mail address you registered with and the 6-digit code from the e-mail, then choose a new password. Your diary entries are kept.',
  'auth.reset.code': 'Code from the e-mail',
  'auth.reset.codeHint': '6 digits',
  'auth.reset.codeInvalid': 'The code is 6 digits.',
  'auth.reset.newPassword': 'New password',
  'auth.reset.confirmPassword': 'Confirm new password',
  'auth.reset.submit': 'Save new password',
  'auth.reset.done': 'Your password was changed and you were signed out on every device. Log in with the new password.',
  'auth.reset.useCode': 'Use the code from the e-mail instead',
  'auth.reset.requestNew': 'Request a new link',
};
export default messages;
