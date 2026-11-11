/** it - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Nome',
  'auth.lastName': 'Cognome',
  'auth.username': 'Nome utente',
  'auth.email': 'E-mail',
  'auth.emailHint': 'Serve per accedere e per reimpostare una password dimenticata',
  'auth.emailInvalid': 'L’indirizzo e-mail non è valido',
  'auth.emailTaken': 'Errore: Questo indirizzo e-mail è già registrato.',
  'auth.usernameTaken': 'Errore: Questo nome utente è già in uso. Scegline un altro.',
  'auth.emailNotSet': 'Non impostato',
  'auth.usernameOrEmail': 'Nome utente o e-mail',
  'auth.password': 'Password',
  'auth.confirmPassword': 'Conferma password',
  'auth.rememberMe': 'Ricordami',
  'auth.rememberMeHint': 'Accedi automaticamente la prossima volta su questo dispositivo',
  'auth.usernameHint': 'Lettere, cifre, punto, trattino o trattino basso (da 3 a 32 caratteri)',
  'auth.passwordHint': 'Almeno {min} caratteri, con lettere e cifre',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Account registrati su questo computer',
  'auth.registeredAccountsHint': 'Scegliendo un nome si compila il nome utente; resta da inserire solo la password.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'selezionato',
  'auth.accountFilled': 'Il nome utente {username} è stato compilato. Inserisci la password.',

  // Titles, buttons and links
  'auth.createAccount': 'Crea account',
  'auth.registerTitle': 'Registrazione',
  'auth.loginTitle': 'Accesso',
  'auth.noAccountYet': 'Non hai ancora un account?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  'auth.legalConsent': 'Ho letto l’{policy} e le {terms} e le accetto',
  'auth.privacyConsentLink': 'informativa sulla privacy',
  'auth.termsConsentLink': 'condizioni d’uso',
  'auth.legalConsentRequired': 'Per creare un account, seleziona questa casella per confermare di aver letto l’informativa sulla privacy e le condizioni d’uso e di accettarle.',
  'auth.alreadyHaveAccount': 'Hai già un account?',

  // Validation and session messages
  'auth.passwordsMismatch': 'Le password non coincidono',
  'auth.loginRequired': 'Accedi prima per continuare alla pagina richiesta.',
  'auth.sessionExpired': 'La sessione è scaduta. Accedi di nuovo.',
  'auth.sessionEnded': 'La sessione è terminata. Accedi di nuovo.',
  'auth.loggedOut': 'Hai effettuato la disconnessione dal diario.',
  'auth.welcomeBack': 'Ciao {firstName}, l’accesso è riuscito.',
  'auth.accountCreated': 'Il tuo account è stato creato. Ciao {firstName}, ti diamo il benvenuto!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Password dimenticata?',
  'auth.forgot.title': 'Password dimenticata',
  'auth.forgot.intro':
    'Inserisci l’indirizzo e-mail usato per la registrazione. Ti invieremo un link e un codice di 6 cifre per scegliere una nuova password. Le voci del tuo diario vengono conservate.',
  'auth.forgot.email': 'Indirizzo e-mail usato per la registrazione',
  'auth.forgot.submit': 'Invia link di reimpostazione',
  'auth.forgot.sendAgain': 'Invia di nuovo',
  'auth.forgot.sent': 'Se questo indirizzo è registrato, ti abbiamo inviato un link e un codice.',
  'auth.forgot.sentNext':
    'Il link e il codice valgono 30 minuti e si possono usare una sola volta. Se l’e-mail non arriva entro qualche minuto, controlla anche la cartella dello spam.',
  'auth.forgot.notAvailable':
    'La reimpostazione della password via e-mail non è ancora configurata in questo diario. L’account proprietario di questo computer può configurarla nelle Impostazioni, nella scheda “E-mail per reimpostare la password”.',
  'auth.forgot.haveCode': 'Inserisci il codice dell’e-mail',
  'auth.forgot.backToLogin': 'Torna all’accesso',
  'auth.reset.title': 'Reimposta password',
  'auth.reset.introLink':
    'Scegli una nuova password per il tuo account. Le voci del tuo diario vengono conservate e la sessione verrà chiusa su tutti i dispositivi.',
  'auth.reset.introCode':
    'Inserisci l’indirizzo e-mail usato per la registrazione e il codice di 6 cifre dell’e-mail, poi scegli una nuova password. Le voci del tuo diario vengono conservate.',
  'auth.reset.code': 'Codice dell’e-mail',
  'auth.reset.codeHint': '6 cifre',
  'auth.reset.codeInvalid': 'Il codice è di 6 cifre.',
  'auth.reset.newPassword': 'Nuova password',
  'auth.reset.confirmPassword': 'Conferma nuova password',
  'auth.reset.submit': 'Salva la nuova password',
  'auth.reset.done':
    'La password è stata cambiata e la sessione è stata chiusa su tutti i dispositivi. Accedi con la nuova password.',
  'auth.reset.useCode': 'Usa invece il codice dell’e-mail',
  'auth.reset.requestNew': 'Richiedi un nuovo link',
};
export default messages;
