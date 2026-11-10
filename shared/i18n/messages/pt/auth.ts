/** pt - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Nome próprio',
  'auth.lastName': 'Apelido',
  'auth.username': 'Nome de utilizador',
  'auth.email': 'E-mail',
  'auth.emailHint': 'Serve para iniciar sessão e para repor uma palavra-passe esquecida',
  'auth.emailInvalid': 'O endereço de e-mail não é válido',
  'auth.emailTaken': 'Erro: Este endereço de e-mail já está registado.',
  'auth.usernameTaken': 'Erro: Este nome de utilizador já está a ser utilizado. Escolha outro.',
  'auth.emailNotSet': 'Não definido',
  'auth.usernameOrEmail': 'Nome de utilizador ou e-mail',
  'auth.password': 'Palavra-passe',
  'auth.confirmPassword': 'Confirmar palavra-passe',
  'auth.rememberMe': 'Manter sessão iniciada',
  'auth.rememberMeHint': 'Iniciar sessão automaticamente da próxima vez neste dispositivo',
  'auth.usernameHint': 'Letras, algarismos, ponto, hífen ou sublinhado (3 a 32 carateres)',
  'auth.passwordHint': 'Pelo menos {min} carateres, com letras e algarismos',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Contas registadas neste computador',
  'auth.registeredAccountsHint': 'Ao escolher um nome, o nome de utilizador é preenchido; só falta introduzir a palavra-passe.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'selecionada',
  'auth.accountFilled': 'O nome de utilizador {username} foi preenchido. Introduza a palavra-passe.',

  // Titles, buttons and links
  'auth.createAccount': 'Criar conta',
  'auth.registerTitle': 'Registar',
  'auth.loginTitle': 'Iniciar sessão',
  'auth.noAccountYet': 'Ainda não tem conta?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  // TODO-TRANSLATE (docs/apple-tasks/TERMS-DIFF.md): English placeholder of the Terms-of-Use keys below - the translator replaces it and removes this line
  'auth.legalConsent': 'I have read the {policy} and the {terms}, and I agree to them',
  'auth.privacyConsentLink': 'política de privacidade',
  'auth.termsConsentLink': 'Terms of Use',
  'auth.legalConsentRequired': 'To create an account, tick this box to confirm that you have read the Privacy Policy and the Terms of Use and agree to them.',
  'auth.alreadyHaveAccount': 'Já tem conta?',

  // Validation and session messages
  'auth.passwordsMismatch': 'As palavras-passe não coincidem',
  'auth.loginRequired': 'Inicie sessão para continuar para a página pedida.',
  'auth.sessionExpired': 'A sua sessão expirou. Inicie sessão novamente.',
  'auth.sessionEnded': 'A sua sessão terminou. Inicie sessão novamente.',
  'auth.loggedOut': 'Terminou a sessão no diário.',
  'auth.welcomeBack': 'Olá, {firstName}. Iniciou sessão com sucesso.',
  'auth.accountCreated': 'A sua conta foi criada. Boas-vindas, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Esqueceu-se da palavra-passe?',
  'auth.forgot.title': 'Palavra-passe esquecida',
  'auth.forgot.intro':
    'Introduza o endereço de e-mail com que se registou. Vamos enviar-lhe uma ligação e um código de 6 dígitos para escolher uma nova palavra-passe. As entradas do seu diário são mantidas.',
  'auth.forgot.email': 'Endereço de e-mail com que se registou',
  'auth.forgot.submit': 'Enviar ligação de reposição',
  'auth.forgot.sendAgain': 'Enviar novamente',
  'auth.forgot.sent': 'Se este endereço estiver registado, enviámos-lhe uma ligação e um código.',
  'auth.forgot.sentNext':
    'A ligação e o código são válidos durante 30 minutos e só podem ser usados uma vez. Se o e-mail não chegar dentro de alguns minutos, verifique também a pasta de spam.',
  'auth.forgot.notAvailable':
    'A reposição da palavra-passe por e-mail ainda não está configurada neste diário. A conta proprietária deste computador pode configurá-la nas Definições, no cartão «E-mail para repor a palavra-passe».',
  'auth.forgot.haveCode': 'Introduzir o código do e-mail',
  'auth.forgot.backToLogin': 'Voltar ao início de sessão',
  'auth.reset.title': 'Repor palavra-passe',
  'auth.reset.introLink':
    'Escolha uma nova palavra-passe para a sua conta. As entradas do seu diário são mantidas e a sessão será terminada em todos os dispositivos.',
  'auth.reset.introCode':
    'Introduza o endereço de e-mail com que se registou e o código de 6 dígitos do e-mail e, depois, escolha uma nova palavra-passe. As entradas do seu diário são mantidas.',
  'auth.reset.code': 'Código do e-mail',
  'auth.reset.codeHint': '6 dígitos',
  'auth.reset.codeInvalid': 'O código tem 6 dígitos.',
  'auth.reset.newPassword': 'Nova palavra-passe',
  'auth.reset.confirmPassword': 'Confirmar a nova palavra-passe',
  'auth.reset.submit': 'Guardar a nova palavra-passe',
  'auth.reset.done':
    'A sua palavra-passe foi alterada e a sessão foi terminada em todos os dispositivos. Inicie sessão com a nova palavra-passe.',
  'auth.reset.useCode': 'Usar antes o código do e-mail',
  'auth.reset.requestNew': 'Pedir uma nova ligação',
};
export default messages;
