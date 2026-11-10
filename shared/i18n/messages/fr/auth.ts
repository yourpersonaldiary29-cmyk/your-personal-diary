/** fr - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Prénom',
  'auth.lastName': 'Nom',
  'auth.username': 'Nom d’utilisateur',
  'auth.email': 'E-mail',
  'auth.emailHint': 'Sert à vous connecter et à réinitialiser un mot de passe oublié',
  'auth.emailInvalid': 'L’adresse e-mail n’est pas valide',
  'auth.emailTaken': 'Erreur : Cette adresse e-mail est déjà enregistrée.',
  'auth.usernameTaken': 'Erreur : Ce nom d’utilisateur est déjà pris. Veuillez en choisir un autre.',
  'auth.emailNotSet': 'Non renseignée',
  'auth.usernameOrEmail': 'Nom d’utilisateur ou e-mail',
  'auth.password': 'Mot de passe',
  'auth.confirmPassword': 'Confirmer le mot de passe',
  'auth.rememberMe': 'Se souvenir de moi',
  'auth.rememberMeHint': 'Connexion automatique la prochaine fois sur cet appareil',
  'auth.usernameHint': 'Lettres, chiffres, point, trait d’union ou tiret bas (3 à 32 caractères)',
  'auth.passwordHint': 'Au moins {min} caractères, avec des lettres et des chiffres',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Comptes enregistrés sur cet ordinateur',
  'auth.registeredAccountsHint': 'Choisir un nom remplit le nom d’utilisateur ; il ne reste plus qu’à saisir le mot de passe.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'sélectionné',
  'auth.accountFilled': 'Le nom d’utilisateur {username} a été rempli. Saisissez le mot de passe.',

  // Titles, buttons and links
  'auth.createAccount': 'Créer un compte',
  'auth.registerTitle': 'Inscription',
  'auth.loginTitle': 'Connexion',
  'auth.noAccountYet': 'Pas encore de compte ?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  // TODO-TRANSLATE (docs/apple-tasks/TERMS-DIFF.md): English placeholder of the Terms-of-Use keys below - the translator replaces it and removes this line
  'auth.legalConsent': 'I have read the {policy} and the {terms}, and I agree to them',
  'auth.privacyConsentLink': 'politique de confidentialité',
  'auth.termsConsentLink': 'Terms of Use',
  'auth.legalConsentRequired': 'To create an account, tick this box to confirm that you have read the Privacy Policy and the Terms of Use and agree to them.',
  'auth.alreadyHaveAccount': 'Vous avez déjà un compte ?',

  // Validation and session messages
  'auth.passwordsMismatch': 'Les mots de passe ne correspondent pas',
  'auth.loginRequired': 'Veuillez d’abord vous connecter pour accéder à la page demandée.',
  'auth.sessionExpired': 'Votre session a expiré. Veuillez vous reconnecter.',
  'auth.sessionEnded': 'Votre session est terminée. Veuillez vous reconnecter.',
  'auth.loggedOut': 'La déconnexion du journal a bien été effectuée.',
  'auth.welcomeBack': 'Bonjour {firstName}, la connexion a réussi.',
  'auth.accountCreated': 'Votre compte a été créé. Bienvenue, {firstName} !',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Mot de passe oublié ?',
  'auth.forgot.title': 'Mot de passe oublié',
  'auth.forgot.intro':
    'Saisissez l’adresse e-mail utilisée lors de votre inscription. Nous vous enverrons un lien et un code à 6 chiffres pour choisir un nouveau mot de passe. Les entrées de votre journal sont conservées.',
  'auth.forgot.email': 'Adresse e-mail utilisée lors de l’inscription',
  'auth.forgot.submit': 'Envoyer le lien de réinitialisation',
  'auth.forgot.sendAgain': 'Renvoyer',
  'auth.forgot.sent': 'Si cette adresse est enregistrée, nous y avons envoyé un lien et un code.',
  'auth.forgot.sentNext':
    'Le lien et le code sont valables 30 minutes et ne peuvent servir qu’une fois. Si l’e-mail n’arrive pas d’ici quelques minutes, vérifiez aussi le dossier des spams.',
  'auth.forgot.notAvailable':
    'La réinitialisation du mot de passe par e-mail n’est pas encore configurée pour ce journal. Le compte propriétaire de cet ordinateur peut la configurer dans les Paramètres, dans la carte « E-mail de réinitialisation du mot de passe ».',
  'auth.forgot.haveCode': 'Saisir le code reçu par e-mail',
  'auth.forgot.backToLogin': 'Retour à la connexion',
  'auth.reset.title': 'Réinitialiser le mot de passe',
  'auth.reset.introLink':
    'Choisissez un nouveau mot de passe pour votre compte. Les entrées de votre journal sont conservées et la session sera fermée sur tous les appareils.',
  'auth.reset.introCode':
    'Saisissez l’adresse e-mail utilisée lors de votre inscription et le code à 6 chiffres reçu par e-mail, puis choisissez un nouveau mot de passe. Les entrées de votre journal sont conservées.',
  'auth.reset.code': 'Code reçu par e-mail',
  'auth.reset.codeHint': '6 chiffres',
  'auth.reset.codeInvalid': 'Le code comporte 6 chiffres.',
  'auth.reset.newPassword': 'Nouveau mot de passe',
  'auth.reset.confirmPassword': 'Confirmer le nouveau mot de passe',
  'auth.reset.submit': 'Enregistrer le nouveau mot de passe',
  'auth.reset.done':
    'Votre mot de passe a été changé et tous les appareils ont été déconnectés. Connectez-vous avec le nouveau mot de passe.',
  'auth.reset.useCode': 'Utiliser plutôt le code reçu par e-mail',
  'auth.reset.requestNew': 'Demander un nouveau lien',
};
export default messages;
