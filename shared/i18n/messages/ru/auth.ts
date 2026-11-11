/** ru - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Имя',
  'auth.lastName': 'Фамилия',
  'auth.username': 'Имя пользователя',
  'auth.email': 'Эл. почта',
  'auth.emailHint': 'Используется для входа и для сброса забытого пароля',
  'auth.emailInvalid': 'Некорректный адрес электронной почты',
  'auth.emailTaken': 'Ошибка: Этот адрес электронной почты уже зарегистрирован.',
  'auth.usernameTaken': 'Ошибка: Это имя пользователя уже занято. Выберите другое.',
  'auth.emailNotSet': 'Не указан',
  'auth.usernameOrEmail': 'Имя пользователя или эл. почта',
  'auth.password': 'Пароль',
  'auth.confirmPassword': 'Подтверждение пароля',
  'auth.rememberMe': 'Запомнить меня',
  'auth.rememberMeHint': 'В следующий раз входить на этом устройстве автоматически',
  'auth.usernameHint': 'Буквы, цифры, точка, дефис или подчёркивание (от 3 до 32 символов)',
  'auth.passwordHint': 'Не менее {min} символов, буквы и цифры',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Аккаунты, зарегистрированные на этом компьютере',
  'auth.registeredAccountsHint': 'При выборе имени подставляется имя пользователя - останется только ввести пароль.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'выбран',
  'auth.accountFilled': 'Имя пользователя {username} подставлено. Введите пароль.',

  // Titles, buttons and links
  'auth.createAccount': 'Создать аккаунт',
  'auth.registerTitle': 'Регистрация',
  'auth.loginTitle': 'Вход',
  'auth.noAccountYet': 'Ещё нет аккаунта?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  'auth.legalConsent': 'Я прочитал(а) {policy} и {terms} и принимаю их',
  'auth.privacyConsentLink': 'политику конфиденциальности',
  'auth.termsConsentLink': 'условия использования',
  'auth.legalConsentRequired': 'Чтобы создать аккаунт, отметьте это поле и подтвердите, что вы прочитали политику конфиденциальности и условия использования и принимаете их.',
  'auth.alreadyHaveAccount': 'Уже есть аккаунт?',

  // Validation and session messages
  'auth.passwordsMismatch': 'Пароли не совпадают',
  'auth.loginRequired': 'Чтобы перейти на запрошенную страницу, сначала войдите.',
  'auth.sessionExpired': 'Срок действия сеанса истёк. Пожалуйста, войдите снова.',
  'auth.sessionEnded': 'Сеанс завершён. Пожалуйста, войдите снова.',
  'auth.loggedOut': 'Вы вышли из дневника.',
  'auth.welcomeBack': 'Здравствуйте, {firstName}! Вход выполнен.',
  'auth.accountCreated': 'Аккаунт создан. Добро пожаловать, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Забыли пароль?',
  'auth.forgot.title': 'Восстановление пароля',
  'auth.forgot.intro':
    'Введите адрес электронной почты, указанный при регистрации. Мы отправим на него ссылку и 6-значный код, чтобы вы могли задать новый пароль. Записи в дневнике сохранятся.',
  'auth.forgot.email': 'Адрес электронной почты, указанный при регистрации',
  'auth.forgot.submit': 'Отправить ссылку для сброса',
  'auth.forgot.sendAgain': 'Отправить ещё раз',
  'auth.forgot.sent': 'Если этот адрес зарегистрирован, мы отправили на него ссылку и код.',
  'auth.forgot.sentNext':
    'Ссылка и код действуют 30 минут и могут быть использованы один раз. Если письмо не придёт в течение нескольких минут, проверьте также папку «Спам».',
  'auth.forgot.notAvailable':
    'Сброс пароля по электронной почте в этом дневнике ещё не настроен. Аккаунт владельца этого компьютера может настроить его в настройках, в карточке «Почта для сброса пароля».',
  'auth.forgot.haveCode': 'Ввести код из письма',
  'auth.forgot.backToLogin': 'Вернуться ко входу',
  'auth.reset.title': 'Сброс пароля',
  'auth.reset.introLink':
    'Задайте новый пароль для аккаунта. Записи в дневнике сохранятся, а все устройства будут отключены от аккаунта.',
  'auth.reset.introCode':
    'Введите адрес электронной почты, указанный при регистрации, и 6-значный код из письма, затем задайте новый пароль. Записи в дневнике сохранятся.',
  'auth.reset.code': 'Код из письма',
  'auth.reset.codeHint': '6 цифр',
  'auth.reset.codeInvalid': 'Код состоит из 6 цифр.',
  'auth.reset.newPassword': 'Новый пароль',
  'auth.reset.confirmPassword': 'Подтверждение нового пароля',
  'auth.reset.submit': 'Сохранить новый пароль',
  'auth.reset.done': 'Пароль изменён, все устройства отключены от аккаунта. Войдите с новым паролем.',
  'auth.reset.useCode': 'Использовать код из письма',
  'auth.reset.requestNew': 'Запросить новую ссылку',
};
export default messages;
