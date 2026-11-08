/** ro - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Prenume',
  'auth.lastName': 'Nume',
  'auth.username': 'Nume de utilizator',
  'auth.email': 'E-mail',
  'auth.emailHint': 'Folosită la conectare și la resetarea unei parole uitate',
  'auth.emailInvalid': 'Adresa de e-mail nu este validă',
  'auth.emailTaken': 'Eroare: Această adresă de e-mail este deja înregistrată.',
  'auth.usernameTaken': 'Eroare: Acest nume de utilizator este deja folosit. Alege altul.',
  'auth.emailNotSet': 'Necompletat',
  'auth.usernameOrEmail': 'Nume de utilizator sau e-mail',
  'auth.password': 'Parolă',
  'auth.confirmPassword': 'Confirmă parola',
  'auth.rememberMe': 'Ține-mă minte',
  'auth.rememberMeHint': 'Conectare automată data viitoare pe acest dispozitiv',
  'auth.usernameHint': 'Litere, cifre, punct, cratimă sau liniuță de subliniere (între 3 și 32 de caractere)',
  'auth.passwordHint': '{min, plural, one {Cel puțin # caracter} few {Cel puțin # caractere} other {Cel puțin # de caractere}}, cu litere și cifre',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Conturi înregistrate pe acest computer',
  'auth.registeredAccountsHint': 'Când alegi un nume, numele de utilizator se completează automat; mai rămâne doar să introduci parola.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'selectat',
  'auth.accountFilled': 'Numele de utilizator {username} a fost completat. Introdu parola.',

  // Titles, buttons and links
  'auth.createAccount': 'Creează cont',
  'auth.registerTitle': 'Creare cont',
  'auth.loginTitle': 'Conectare',
  'auth.noAccountYet': 'Nu ai încă un cont?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent): {policy} = the link
  // auth.privacyConsentLink (worded to fit this sentence); auth.privacyConsentRequired shows under the unticked box
  'auth.privacyConsent': 'Am citit {policy} și sunt de acord cu ea',
  'auth.privacyConsentLink': 'politica de confidențialitate',
  'auth.privacyConsentRequired': 'Pentru a crea un cont, bifează această casetă ca să confirmi că ai citit politica de confidențialitate și ești de acord cu ea.',
  'auth.alreadyHaveAccount': 'Ai deja un cont?',

  // Validation and session messages
  'auth.passwordsMismatch': 'Parolele nu coincid',
  'auth.loginRequired': 'Conectează-te mai întâi ca să poți continua spre pagina cerută.',
  'auth.sessionExpired': 'Sesiunea ta a expirat. Conectează-te din nou.',
  'auth.sessionEnded': 'Sesiunea ta s-a încheiat. Conectează-te din nou.',
  'auth.loggedOut': 'Te-ai deconectat de la jurnal.',
  'auth.welcomeBack': 'Bună, {firstName}, te-ai conectat cu succes.',
  'auth.accountCreated': 'Contul tău a fost creat. Bine ai venit, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Ai uitat parola?',
  'auth.forgot.title': 'Parolă uitată',
  'auth.forgot.intro':
    'Introdu adresa de e-mail folosită la înregistrare. Îți vom trimite un link și un cod din 6 cifre pentru a alege o parolă nouă. Însemnările din jurnal se păstrează.',
  'auth.forgot.email': 'Adresa de e-mail folosită la înregistrare',
  'auth.forgot.submit': 'Trimite linkul de resetare',
  'auth.forgot.sendAgain': 'Trimite din nou',
  'auth.forgot.sent': 'Dacă această adresă este înregistrată, am trimis la ea un link și un cod.',
  'auth.forgot.sentNext':
    'Linkul și codul sunt valabile 30 de minute și pot fi folosite o singură dată. Dacă e-mailul nu sosește în câteva minute, verifică și dosarul de spam.',
  'auth.forgot.notAvailable':
    'Resetarea parolei prin e-mail nu este încă configurată pentru acest jurnal. Contul care deține acest computer o poate configura în Setări, în cardul „E-mail pentru resetarea parolei”.',
  'auth.forgot.haveCode': 'Introdu codul din e-mail',
  'auth.forgot.backToLogin': 'Înapoi la conectare',
  'auth.reset.title': 'Resetează parola',
  'auth.reset.introLink':
    'Alege o parolă nouă pentru contul tău. Însemnările din jurnal se păstrează, iar sesiunea va fi închisă pe toate dispozitivele.',
  'auth.reset.introCode':
    'Introdu adresa de e-mail folosită la înregistrare și codul din 6 cifre din e-mail, apoi alege o parolă nouă. Însemnările din jurnal se păstrează.',
  'auth.reset.code': 'Codul din e-mail',
  'auth.reset.codeHint': '6 cifre',
  'auth.reset.codeInvalid': 'Codul are 6 cifre.',
  'auth.reset.newPassword': 'Parola nouă',
  'auth.reset.confirmPassword': 'Confirmă parola nouă',
  'auth.reset.submit': 'Salvează parola nouă',
  'auth.reset.done':
    'Parola a fost schimbată, iar sesiunea a fost închisă pe toate dispozitivele. Conectează-te cu parola nouă.',
  'auth.reset.useCode': 'Folosește în schimb codul din e-mail',
  'auth.reset.requestNew': 'Cere un link nou',
};
export default messages;
