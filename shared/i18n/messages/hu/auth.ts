/** hu - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Keresztnév',
  'auth.lastName': 'Vezetéknév',
  'auth.username': 'Felhasználónév',
  'auth.email': 'E-mail',
  'auth.emailHint': 'Bejelentkezéshez és elfelejtett jelszó visszaállításához használjuk',
  'auth.emailInvalid': 'Az e-mail-cím érvénytelen',
  'auth.emailTaken': 'Hiba: Ez az e-mail-cím már regisztrálva van.',
  'auth.usernameTaken': 'Hiba: Ez a felhasználónév már foglalt. Kérlek, válassz másikat.',
  'auth.emailNotSet': 'Nincs megadva',
  'auth.usernameOrEmail': 'Felhasználónév vagy e-mail',
  'auth.password': 'Jelszó',
  'auth.confirmPassword': 'Jelszó megerősítése',
  'auth.rememberMe': 'Emlékezz rám',
  'auth.rememberMeHint': 'Legközelebb automatikus bejelentkezés ezen az eszközön',
  'auth.usernameHint': 'Betűk, számjegyek, pont, kötőjel vagy aláhúzásjel (3–32 karakter)',
  'auth.passwordHint': 'Legalább {min} karakter, betűkkel és számjegyekkel',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Ezen a számítógépen regisztrált fiókok',
  'auth.registeredAccountsHint': 'Egy név kiválasztásával kitöltődik a felhasználónév; már csak a jelszót kell megadnod.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'kiválasztva',
  'auth.accountFilled': 'Felhasználónév kitöltve: {username}. Add meg a jelszót.',

  // Titles, buttons and links
  'auth.createAccount': 'Fiók létrehozása',
  'auth.registerTitle': 'Regisztráció',
  'auth.loginTitle': 'Bejelentkezés',
  'auth.noAccountYet': 'Még nincs fiókod?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent): {policy} = the link
  // auth.privacyConsentLink (worded to fit this sentence); auth.privacyConsentRequired shows under the unticked box
  'auth.privacyConsent': 'Elolvastam az {policy}, és elfogadom őket',
  'auth.privacyConsentLink': 'adatvédelmi irányelveket',
  'auth.privacyConsentRequired': 'A fiók létrehozásához jelöld be ezt a négyzetet, és ezzel erősítsd meg, hogy elolvastad az adatvédelmi irányelveket, és elfogadod őket.',
  'auth.alreadyHaveAccount': 'Már van fiókod?',

  // Validation and session messages
  'auth.passwordsMismatch': 'A jelszavak nem egyeznek',
  'auth.loginRequired': 'A kért oldal megnyitásához előbb jelentkezz be.',
  'auth.sessionExpired': 'A munkameneted lejárt. Kérlek, jelentkezz be újra.',
  'auth.sessionEnded': 'A munkameneted véget ért. Kérlek, jelentkezz be újra.',
  'auth.loggedOut': 'Kijelentkeztél a naplóból.',
  'auth.welcomeBack': 'Szia, {firstName}! Sikeresen bejelentkeztél.',
  'auth.accountCreated': 'A fiókod elkészült. Üdv, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Elfelejtetted a jelszavad?',
  'auth.forgot.title': 'Elfelejtett jelszó',
  'auth.forgot.intro':
    'Add meg az e-mail-címet, amellyel regisztráltál. Küldünk rá egy linket és egy 6 jegyű kódot, amellyel új jelszót választhatsz. A naplóbejegyzéseid megmaradnak.',
  'auth.forgot.email': 'A regisztrációkor megadott e-mail-cím',
  'auth.forgot.submit': 'Visszaállító link küldése',
  'auth.forgot.sendAgain': 'Újraküldés',
  'auth.forgot.sent': 'Ha ez a cím regisztrálva van, küldtünk rá egy linket és egy kódot.',
  'auth.forgot.sentNext':
    'A link és a kód 30 percig érvényes, és csak egyszer használható. Ha az e-mail néhány percen belül nem érkezik meg, nézd meg a levélszemét mappát is.',
  'auth.forgot.notAvailable':
    'Az e-mailes jelszó-visszaállítás ebben a naplóban még nincs beállítva. A számítógépet birtokló fiók a Beállításokban, „A jelszó visszaállításához használt e-mail” kártyán állíthatja be.',
  'auth.forgot.haveCode': 'Az e-mailben kapott kód megadása',
  'auth.forgot.backToLogin': 'Vissza a bejelentkezéshez',
  'auth.reset.title': 'Jelszó visszaállítása',
  'auth.reset.introLink':
    'Válassz új jelszót a fiókodhoz. A naplóbejegyzéseid megmaradnak, és minden eszközön kijelentkeztetünk.',
  'auth.reset.introCode':
    'Add meg az e-mail-címet, amellyel regisztráltál, és az e-mailben kapott 6 jegyű kódot, majd válassz új jelszót. A naplóbejegyzéseid megmaradnak.',
  'auth.reset.code': 'Az e-mailben kapott kód',
  'auth.reset.codeHint': '6 számjegy',
  'auth.reset.codeInvalid': 'A kód 6 számjegyből áll.',
  'auth.reset.newPassword': 'Új jelszó',
  'auth.reset.confirmPassword': 'Új jelszó megerősítése',
  'auth.reset.submit': 'Új jelszó mentése',
  'auth.reset.done': 'A jelszavad megváltozott, és minden eszközön kijelentkeztettünk. Jelentkezz be az új jelszóval.',
  'auth.reset.useCode': 'Inkább az e-mailben kapott kódot használom',
  'auth.reset.requestNew': 'Új link kérése',
};
export default messages;
