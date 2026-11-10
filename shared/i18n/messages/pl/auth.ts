/** pl - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Imię',
  'auth.lastName': 'Nazwisko',
  'auth.username': 'Nazwa użytkownika',
  'auth.email': 'E-mail',
  'auth.emailHint': 'Służy do logowania i do resetowania zapomnianego hasła',
  'auth.emailInvalid': 'Adres e-mail jest nieprawidłowy',
  'auth.emailTaken': 'Błąd: Ten adres e-mail jest już zarejestrowany.',
  'auth.usernameTaken': 'Błąd: Ta nazwa użytkownika jest już zajęta. Wybierz inną.',
  'auth.emailNotSet': 'Nie ustawiono',
  'auth.usernameOrEmail': 'Nazwa użytkownika lub e-mail',
  'auth.password': 'Hasło',
  'auth.confirmPassword': 'Potwierdź hasło',
  'auth.rememberMe': 'Zapamiętaj mnie',
  'auth.rememberMeHint': 'Następnym razem loguj automatycznie na tym urządzeniu',
  'auth.usernameHint': 'Litery, cyfry, kropka, łącznik lub podkreślenie (od 3 do 32 znaków)',
  'auth.passwordHint': 'Co najmniej {min} znaków, w tym litery i cyfry',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Konta zarejestrowane na tym komputerze',
  'auth.registeredAccountsHint': 'Wybranie nazwy uzupełnia nazwę użytkownika – pozostaje tylko wpisać hasło.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'wybrane',
  'auth.accountFilled': 'Uzupełniono nazwę użytkownika {username}. Wpisz hasło.',

  // Titles, buttons and links
  'auth.createAccount': 'Utwórz konto',
  'auth.registerTitle': 'Rejestracja',
  'auth.loginTitle': 'Logowanie',
  'auth.noAccountYet': 'Nie masz jeszcze konta?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  // TODO-TRANSLATE (docs/apple-tasks/TERMS-DIFF.md): English placeholder of the Terms-of-Use keys below - the translator replaces it and removes this line
  'auth.legalConsent': 'I have read the {policy} and the {terms}, and I agree to them',
  'auth.privacyConsentLink': 'polityką prywatności',
  'auth.termsConsentLink': 'Terms of Use',
  'auth.legalConsentRequired': 'To create an account, tick this box to confirm that you have read the Privacy Policy and the Terms of Use and agree to them.',
  'auth.alreadyHaveAccount': 'Masz już konto?',

  // Validation and session messages
  'auth.passwordsMismatch': 'Hasła nie są identyczne',
  'auth.loginRequired': 'Zaloguj się, aby przejść do żądanej strony.',
  'auth.sessionExpired': 'Sesja wygasła. Zaloguj się ponownie.',
  'auth.sessionEnded': 'Sesja została zakończona. Zaloguj się ponownie.',
  'auth.loggedOut': 'Wylogowano z dziennika.',
  'auth.welcomeBack': 'Cześć, {firstName}! Logowanie przebiegło pomyślnie.',
  'auth.accountCreated': 'Konto zostało utworzone. Witaj, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Nie pamiętasz hasła?',
  'auth.forgot.title': 'Zapomniane hasło',
  'auth.forgot.intro':
    'Wpisz adres e-mail podany przy rejestracji. Wyślemy na niego link i 6-cyfrowy kod do ustawienia nowego hasła. Wpisy w dzienniku zostaną zachowane.',
  'auth.forgot.email': 'Adres e-mail podany przy rejestracji',
  'auth.forgot.submit': 'Wyślij link do resetowania',
  'auth.forgot.sendAgain': 'Wyślij ponownie',
  'auth.forgot.sent': 'Jeśli ten adres jest zarejestrowany, wysłaliśmy na niego link i kod.',
  'auth.forgot.sentNext':
    'Link i kod są ważne przez 30 minut i można ich użyć tylko raz. Jeśli wiadomość nie dotrze w ciągu kilku minut, sprawdź też folder spamu.',
  'auth.forgot.notAvailable':
    'Resetowanie hasła przez e-mail nie jest jeszcze skonfigurowane w tym dzienniku. Konto właściciela tego komputera może je skonfigurować w Ustawieniach, na karcie „E-mail do resetowania hasła”.',
  'auth.forgot.haveCode': 'Wpisz kod z wiadomości e-mail',
  'auth.forgot.backToLogin': 'Wróć do logowania',
  'auth.reset.title': 'Resetowanie hasła',
  'auth.reset.introLink':
    'Ustaw nowe hasło do konta. Wpisy w dzienniku zostaną zachowane, a wszystkie urządzenia zostaną wylogowane.',
  'auth.reset.introCode':
    'Wpisz adres e-mail podany przy rejestracji i 6-cyfrowy kod z wiadomości, a potem ustaw nowe hasło. Wpisy w dzienniku zostaną zachowane.',
  'auth.reset.code': 'Kod z wiadomości e-mail',
  'auth.reset.codeHint': '6 cyfr',
  'auth.reset.codeInvalid': 'Kod składa się z 6 cyfr.',
  'auth.reset.newPassword': 'Nowe hasło',
  'auth.reset.confirmPassword': 'Potwierdź nowe hasło',
  'auth.reset.submit': 'Zapisz nowe hasło',
  'auth.reset.done': 'Hasło zostało zmienione, a wszystkie urządzenia zostały wylogowane. Zaloguj się nowym hasłem.',
  'auth.reset.useCode': 'Użyj zamiast tego kodu z wiadomości',
  'auth.reset.requestNew': 'Poproś o nowy link',
};
export default messages;
