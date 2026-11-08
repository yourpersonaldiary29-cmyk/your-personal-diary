/** de - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Vorname',
  'auth.lastName': 'Nachname',
  'auth.username': 'Benutzername',
  'auth.email': 'E-Mail',
  'auth.emailHint': 'Wird für die Anmeldung und zum Zurücksetzen eines vergessenen Passworts verwendet',
  'auth.emailInvalid': 'Die E-Mail-Adresse ist ungültig',
  'auth.emailTaken': 'Fehler: Diese E-Mail-Adresse ist bereits registriert.',
  'auth.usernameTaken': 'Fehler: Dieser Benutzername ist bereits vergeben. Bitte wähle einen anderen.',
  'auth.emailNotSet': 'Nicht angegeben',
  'auth.usernameOrEmail': 'Benutzername oder E-Mail',
  'auth.password': 'Passwort',
  'auth.confirmPassword': 'Passwort bestätigen',
  'auth.rememberMe': 'Angemeldet bleiben',
  'auth.rememberMeHint': 'Beim nächsten Mal auf diesem Gerät automatisch anmelden',
  'auth.usernameHint': 'Buchstaben, Ziffern, Punkt, Bindestrich oder Unterstrich (3 bis 32 Zeichen)',
  'auth.passwordHint': 'Mindestens {min} Zeichen, mit Buchstaben und Ziffern',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Auf diesem Computer registrierte Konten',
  'auth.registeredAccountsHint': 'Wenn du einen Namen auswählst, wird der Benutzername eingetragen – du musst nur noch das Passwort eingeben.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'ausgewählt',
  'auth.accountFilled': 'Der Benutzername {username} wurde eingetragen. Gib jetzt das Passwort ein.',

  // Titles, buttons and links
  'auth.createAccount': 'Konto erstellen',
  'auth.registerTitle': 'Registrieren',
  'auth.loginTitle': 'Anmelden',
  'auth.noAccountYet': 'Noch kein Konto?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent): {policy} = the link
  // auth.privacyConsentLink (worded to fit this sentence); auth.privacyConsentRequired shows under the unticked box
  'auth.privacyConsent': 'Ich habe die {policy} gelesen und stimme ihr zu',
  'auth.privacyConsentLink': 'Datenschutzerklärung',
  'auth.privacyConsentRequired': 'Um ein Konto zu erstellen, setze hier ein Häkchen und bestätige damit, dass du die Datenschutzerklärung gelesen hast und ihr zustimmst.',
  'auth.alreadyHaveAccount': 'Du hast schon ein Konto?',

  // Validation and session messages
  'auth.passwordsMismatch': 'Die Passwörter stimmen nicht überein',
  'auth.loginRequired': 'Bitte melde dich zuerst an, um die gewünschte Seite zu öffnen.',
  'auth.sessionExpired': 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
  'auth.sessionEnded': 'Deine Sitzung wurde beendet. Bitte melde dich erneut an.',
  'auth.loggedOut': 'Du hast dich vom Tagebuch abgemeldet.',
  'auth.welcomeBack': 'Hallo {firstName}, du hast dich erfolgreich angemeldet.',
  'auth.accountCreated': 'Dein Konto wurde erstellt. Willkommen, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Passwort vergessen?',
  'auth.forgot.title': 'Passwort vergessen',
  'auth.forgot.intro':
    'Gib die E-Mail-Adresse ein, mit der du dich registriert hast. Wir schicken dir einen Link und einen 6-stelligen Code, mit denen du ein neues Passwort wählen kannst. Deine Tagebucheinträge bleiben erhalten.',
  'auth.forgot.email': 'E-Mail-Adresse, mit der du dich registriert hast',
  'auth.forgot.submit': 'Link zum Zurücksetzen senden',
  'auth.forgot.sendAgain': 'Erneut senden',
  'auth.forgot.sent': 'Falls diese Adresse registriert ist, haben wir einen Link und einen Code an sie geschickt.',
  'auth.forgot.sentNext':
    'Link und Code sind 30 Minuten lang gültig und können nur einmal verwendet werden. Falls die E-Mail nicht innerhalb weniger Minuten ankommt, sieh auch im Spam-Ordner nach.',
  'auth.forgot.notAvailable':
    'Das Zurücksetzen des Passworts per E-Mail ist für dieses Tagebuch noch nicht eingerichtet. Das Konto, dem dieser Computer gehört, kann es in den Einstellungen auf der Karte „E-Mail zum Zurücksetzen des Passworts“ einrichten.',
  'auth.forgot.haveCode': 'Code aus der E-Mail eingeben',
  'auth.forgot.backToLogin': 'Zurück zur Anmeldung',
  'auth.reset.title': 'Passwort zurücksetzen',
  'auth.reset.introLink':
    'Wähle ein neues Passwort für dein Konto. Deine Tagebucheinträge bleiben erhalten, und du wirst auf allen Geräten abgemeldet.',
  'auth.reset.introCode':
    'Gib die E-Mail-Adresse, mit der du dich registriert hast, und den 6-stelligen Code aus der E-Mail ein und wähle dann ein neues Passwort. Deine Tagebucheinträge bleiben erhalten.',
  'auth.reset.code': 'Code aus der E-Mail',
  'auth.reset.codeHint': '6 Ziffern',
  'auth.reset.codeInvalid': 'Der Code besteht aus 6 Ziffern.',
  'auth.reset.newPassword': 'Neues Passwort',
  'auth.reset.confirmPassword': 'Neues Passwort bestätigen',
  'auth.reset.submit': 'Neues Passwort speichern',
  'auth.reset.done':
    'Dein Passwort wurde geändert, und du wurdest auf allen Geräten abgemeldet. Melde dich mit dem neuen Passwort an.',
  'auth.reset.useCode': 'Stattdessen den Code aus der E-Mail verwenden',
  'auth.reset.requestNew': 'Neuen Link anfordern',
};
export default messages;
