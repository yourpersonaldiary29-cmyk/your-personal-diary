/** es - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Nombre',
  'auth.lastName': 'Apellidos',
  'auth.username': 'Nombre de usuario',
  'auth.email': 'Correo electrónico',
  'auth.emailHint': 'Sirve para iniciar sesión y para restablecer una contraseña olvidada',
  'auth.emailInvalid': 'La dirección de correo electrónico no es válida',
  'auth.emailTaken': 'Error: Esta dirección de correo electrónico ya está registrada.',
  'auth.usernameTaken': 'Error: Este nombre de usuario ya está en uso. Elige otro.',
  'auth.emailNotSet': 'Sin definir',
  'auth.usernameOrEmail': 'Nombre de usuario o correo electrónico',
  'auth.password': 'Contraseña',
  'auth.confirmPassword': 'Confirmar contraseña',
  'auth.rememberMe': 'Recordarme',
  'auth.rememberMeHint': 'Iniciar sesión automáticamente la próxima vez en este dispositivo',
  'auth.usernameHint': 'Letras, números, punto, guion o guion bajo (de 3 a 32 caracteres)',
  'auth.passwordHint': 'Al menos {min} caracteres, con letras y números',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Cuentas registradas en este ordenador',
  'auth.registeredAccountsHint': 'Al elegir un nombre se rellena el nombre de usuario; solo tendrás que introducir la contraseña.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'seleccionada',
  'auth.accountFilled': 'Se ha rellenado el nombre de usuario {username}. Introduce la contraseña.',

  // Titles, buttons and links
  'auth.createAccount': 'Crear cuenta',
  'auth.registerTitle': 'Registrarse',
  'auth.loginTitle': 'Iniciar sesión',
  'auth.noAccountYet': '¿Todavía no tienes cuenta?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  'auth.legalConsent': 'He leído la {policy} y las {terms}, y las acepto',
  'auth.privacyConsentLink': 'política de privacidad',
  'auth.termsConsentLink': 'condiciones de uso',
  'auth.legalConsentRequired': 'Para crear una cuenta, marca esta casilla para confirmar que has leído la política de privacidad y las condiciones de uso y las aceptas.',
  'auth.alreadyHaveAccount': '¿Ya tienes cuenta?',

  // Validation and session messages
  'auth.passwordsMismatch': 'Las contraseñas no coinciden',
  'auth.loginRequired': 'Inicia sesión para continuar a la página solicitada.',
  'auth.sessionExpired': 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  'auth.sessionEnded': 'Tu sesión ha finalizado. Vuelve a iniciar sesión.',
  'auth.loggedOut': 'Has cerrado la sesión del diario.',
  'auth.welcomeBack': 'Hola, {firstName}. Has iniciado sesión correctamente.',
  'auth.accountCreated': 'Se ha creado tu cuenta. ¡Te damos la bienvenida, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': '¿Has olvidado la contraseña?',
  'auth.forgot.title': 'Contraseña olvidada',
  'auth.forgot.intro':
    'Introduce la dirección de correo electrónico con la que te registraste. Te enviaremos un enlace y un código de 6 dígitos para elegir una contraseña nueva. Las entradas de tu diario se conservan.',
  'auth.forgot.email': 'Dirección de correo con la que te registraste',
  'auth.forgot.submit': 'Enviar enlace de restablecimiento',
  'auth.forgot.sendAgain': 'Volver a enviar',
  'auth.forgot.sent': 'Si esta dirección está registrada, le hemos enviado un enlace y un código.',
  'auth.forgot.sentNext':
    'El enlace y el código son válidos durante 30 minutos y solo se pueden usar una vez. Si el correo no llega en unos minutos, revisa también la carpeta de spam.',
  'auth.forgot.notAvailable':
    'El restablecimiento de contraseña por correo aún no está configurado en este diario. La cuenta propietaria de este ordenador puede configurarlo en Ajustes, en la tarjeta «Correo para restablecer la contraseña».',
  'auth.forgot.haveCode': 'Introducir el código del correo',
  'auth.forgot.backToLogin': 'Volver a iniciar sesión',
  'auth.reset.title': 'Restablecer contraseña',
  'auth.reset.introLink':
    'Elige una contraseña nueva para tu cuenta. Las entradas de tu diario se conservan y se cerrará la sesión en todos los dispositivos.',
  'auth.reset.introCode':
    'Introduce la dirección de correo con la que te registraste y el código de 6 dígitos del correo; después, elige una contraseña nueva. Las entradas de tu diario se conservan.',
  'auth.reset.code': 'Código del correo',
  'auth.reset.codeHint': '6 dígitos',
  'auth.reset.codeInvalid': 'El código tiene 6 dígitos.',
  'auth.reset.newPassword': 'Nueva contraseña',
  'auth.reset.confirmPassword': 'Confirmar la nueva contraseña',
  'auth.reset.submit': 'Guardar la contraseña nueva',
  'auth.reset.done':
    'Tu contraseña se ha cambiado y se ha cerrado la sesión en todos los dispositivos. Inicia sesión con la contraseña nueva.',
  'auth.reset.useCode': 'Usar el código del correo',
  'auth.reset.requestNew': 'Pedir un enlace nuevo',
};
export default messages;
