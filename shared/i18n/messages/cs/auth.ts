/** cs - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Jméno',
  'auth.lastName': 'Příjmení',
  'auth.username': 'Uživatelské jméno',
  'auth.email': 'E-mail',
  'auth.emailHint': 'Slouží k přihlášení a k obnovení zapomenutého hesla',
  'auth.emailInvalid': 'E-mailová adresa není platná',
  'auth.emailTaken': 'Chyba: Tato e-mailová adresa je už zaregistrovaná.',
  'auth.usernameTaken': 'Chyba: Toto uživatelské jméno je už obsazené. Zvol prosím jiné.',
  'auth.emailNotSet': 'Nenastaveno',
  'auth.usernameOrEmail': 'Uživatelské jméno nebo e-mail',
  'auth.password': 'Heslo',
  'auth.confirmPassword': 'Potvrzení hesla',
  'auth.rememberMe': 'Zapamatovat si mě',
  'auth.rememberMeHint': 'Příště se na tomto zařízení přihlásit automaticky',
  'auth.usernameHint': 'Písmena, číslice, tečka, pomlčka nebo podtržítko (3 až 32 znaků)',
  'auth.passwordHint': 'Alespoň {min} znaků, písmena i číslice',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Účty zaregistrované v tomto počítači',
  'auth.registeredAccountsHint': 'Výběrem jména se vyplní uživatelské jméno; zbývá jen zadat heslo.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'vybráno',
  'auth.accountFilled': 'Uživatelské jméno {username} je vyplněné. Zadej heslo.',

  // Titles, buttons and links
  'auth.createAccount': 'Vytvořit účet',
  'auth.registerTitle': 'Registrace',
  'auth.loginTitle': 'Přihlášení',
  'auth.noAccountYet': 'Ještě nemáš účet?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent): {policy} = the link
  // auth.privacyConsentLink (worded to fit this sentence); auth.privacyConsentRequired shows under the unticked box
  'auth.privacyConsent': 'Přečetl(a) jsem si {policy} a souhlasím s nimi',
  'auth.privacyConsentLink': 'zásady ochrany osobních údajů',
  'auth.privacyConsentRequired': 'Pro vytvoření účtu zaškrtni toto políčko a potvrď tím, že sis přečetl(a) zásady ochrany osobních údajů a souhlasíš s nimi.',
  'auth.alreadyHaveAccount': 'Už máš účet?',

  // Validation and session messages
  'auth.passwordsMismatch': 'Hesla se neshodují',
  'auth.loginRequired': 'Pro pokračování na požadovanou stránku se nejdřív přihlas.',
  'auth.sessionExpired': 'Platnost přihlášení vypršela. Přihlas se prosím znovu.',
  'auth.sessionEnded': 'Přihlášení skončilo. Přihlas se prosím znovu.',
  'auth.loggedOut': 'Odhlášení z deníku proběhlo úspěšně.',
  'auth.welcomeBack': 'Ahoj {firstName}, přihlášení proběhlo úspěšně.',
  'auth.accountCreated': 'Tvůj účet je vytvořený. Vítej, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Zapomenuté heslo?',
  'auth.forgot.title': 'Zapomenuté heslo',
  'auth.forgot.intro':
    'Zadej e-mailovou adresu uvedenou při registraci. Pošleme na ni odkaz a šestimístný kód, kterými si zvolíš nové heslo. Záznamy v deníku zůstanou zachované.',
  'auth.forgot.email': 'E-mailová adresa uvedená při registraci',
  'auth.forgot.submit': 'Poslat odkaz k obnovení',
  'auth.forgot.sendAgain': 'Poslat znovu',
  'auth.forgot.sent': 'Pokud je tato adresa zaregistrovaná, poslali jsme na ni odkaz a kód.',
  'auth.forgot.sentNext':
    'Odkaz i kód platí 30 minut a dají se použít jen jednou. Pokud e-mail do několika minut nedorazí, podívej se i do složky se spamem.',
  'auth.forgot.notAvailable':
    'Obnovení hesla e-mailem zatím v tomto deníku není nastavené. Účet, kterému tento počítač patří, ho může nastavit v Nastavení na kartě „E-mail pro obnovení hesla“.',
  'auth.forgot.haveCode': 'Zadat kód z e-mailu',
  'auth.forgot.backToLogin': 'Zpět na přihlášení',
  'auth.reset.title': 'Obnovení hesla',
  'auth.reset.introLink':
    'Zvol nové heslo ke svému účtu. Záznamy v deníku zůstanou zachované a všechna zařízení budou odhlášena.',
  'auth.reset.introCode':
    'Zadej e-mailovou adresu uvedenou při registraci a šestimístný kód z e-mailu a pak zvol nové heslo. Záznamy v deníku zůstanou zachované.',
  'auth.reset.code': 'Kód z e-mailu',
  'auth.reset.codeHint': '6 číslic',
  'auth.reset.codeInvalid': 'Kód má 6 číslic.',
  'auth.reset.newPassword': 'Nové heslo',
  'auth.reset.confirmPassword': 'Potvrzení nového hesla',
  'auth.reset.submit': 'Uložit nové heslo',
  'auth.reset.done': 'Heslo je změněné a všechna zařízení byla odhlášena. Přihlas se novým heslem.',
  'auth.reset.useCode': 'Použít místo toho kód z e-mailu',
  'auth.reset.requestNew': 'Požádat o nový odkaz',
};
export default messages;
