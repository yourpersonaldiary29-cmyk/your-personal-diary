/** bg - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Име',
  'auth.lastName': 'Фамилия',
  'auth.username': 'Потребителско име',
  'auth.email': 'Имейл',
  'auth.emailHint': 'Използва се за вход и за възстановяване на забравена парола',
  'auth.emailInvalid': 'Имейл адресът не е валиден',
  'auth.emailTaken': 'Грешка: Този имейл адрес вече е регистриран.',
  'auth.usernameTaken': 'Грешка: Това потребителско име вече е заето. Моля, изберете друго.',
  'auth.emailNotSet': 'Не е зададен',
  'auth.usernameOrEmail': 'Потребителско име или имейл',
  'auth.password': 'Парола',
  'auth.confirmPassword': 'Потвърдете паролата',
  'auth.rememberMe': 'Запомни ме',
  'auth.rememberMeHint': 'Автоматичен вход следващия път на това устройство',
  'auth.usernameHint': 'Букви, цифри, точка, тире или долна черта (от 3 до 32 знака)',
  'auth.passwordHint': 'Поне {min} знака, с букви и цифри',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Профили, регистрирани на този компютър',
  'auth.registeredAccountsHint': 'Когато изберете име, потребителското име се попълва и остава само да въведете паролата.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'избран',
  'auth.accountFilled': 'Потребителското име {username} е попълнено. Въведете паролата.',

  // Titles, buttons and links
  'auth.createAccount': 'Създай профил',
  'auth.registerTitle': 'Регистрация',
  'auth.loginTitle': 'Вход',
  'auth.noAccountYet': 'Все още нямате профил?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  'auth.legalConsent': 'Прочетох {policy} и {terms} и ги приемам',
  'auth.privacyConsentLink': 'политиката за поверителност',
  'auth.termsConsentLink': 'условията за ползване',
  'auth.legalConsentRequired': 'За да създадеш профил, отбележи това поле и така потвърди, че политиката за поверителност и условията за ползване са прочетени и приети от теб.',
  'auth.alreadyHaveAccount': 'Вече имате профил?',

  // Validation and session messages
  'auth.passwordsMismatch': 'Паролите не съвпадат',
  'auth.loginRequired': 'Моля, първо влезте, за да продължите към исканата страница.',
  'auth.sessionExpired': 'Сесията ви изтече. Моля, влезте отново.',
  'auth.sessionEnded': 'Сесията ви приключи. Моля, влезте отново.',
  'auth.loggedOut': 'Излязохте от дневника.',
  'auth.welcomeBack': 'Здравейте, {firstName}, влязохте успешно.',
  'auth.accountCreated': 'Профилът ви беше създаден. Добре дошли, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Забравена парола?',
  'auth.forgot.title': 'Забравена парола',
  'auth.forgot.intro':
    'Въведете имейл адреса, с който сте се регистрирали. Ще ви изпратим линк и 6-цифрен код, с които да изберете нова парола. Записите в дневника ви се запазват.',
  'auth.forgot.email': 'Имейл адресът, с който сте се регистрирали',
  'auth.forgot.submit': 'Изпрати линк за нулиране',
  'auth.forgot.sendAgain': 'Изпрати отново',
  'auth.forgot.sent': 'Ако този адрес е регистриран, изпратихме до него линк и код.',
  'auth.forgot.sentNext':
    'Линкът и кодът са валидни 30 минути и могат да се използват само веднъж. Ако имейлът не пристигне до няколко минути, проверете и папката за спам.',
  'auth.forgot.notAvailable':
    'Нулирането на паролата по имейл все още не е настроено за този дневник. Профилът, на който принадлежи този компютър, може да го настрои в Настройки, в картата „Имейл за нулиране на паролата“.',
  'auth.forgot.haveCode': 'Въведете кода от имейла',
  'auth.forgot.backToLogin': 'Обратно към входа',
  'auth.reset.title': 'Нулиране на паролата',
  'auth.reset.introLink':
    'Изберете нова парола за профила си. Записите в дневника ви се запазват, а всички устройства ще бъдат отписани.',
  'auth.reset.introCode':
    'Въведете имейл адреса, с който сте се регистрирали, и 6-цифрения код от имейла, след което изберете нова парола. Записите в дневника ви се запазват.',
  'auth.reset.code': 'Код от имейла',
  'auth.reset.codeHint': '6 цифри',
  'auth.reset.codeInvalid': 'Кодът се състои от 6 цифри.',
  'auth.reset.newPassword': 'Нова парола',
  'auth.reset.confirmPassword': 'Потвърдете новата парола',
  'auth.reset.submit': 'Запази новата парола',
  'auth.reset.done': 'Паролата е сменена и всички устройства са отписани. Влезте с новата парола.',
  'auth.reset.useCode': 'Използвайте кода от имейла',
  'auth.reset.requestNew': 'Поискайте нов линк',
};
export default messages;
