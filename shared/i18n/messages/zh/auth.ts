/** zh - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': '名字',
  'auth.lastName': '姓氏',
  'auth.username': '用户名',
  'auth.email': '电子邮箱',
  'auth.emailHint': '用于登录和重置忘记的密码',
  'auth.emailInvalid': '电子邮箱地址无效',
  'auth.emailTaken': '错误：该电子邮箱地址已注册。',
  'auth.usernameTaken': '错误：该用户名已被使用，请换一个。',
  'auth.emailNotSet': '未设置',
  'auth.usernameOrEmail': '用户名或电子邮箱',
  'auth.password': '密码',
  'auth.confirmPassword': '确认密码',
  'auth.rememberMe': '记住我',
  'auth.rememberMeHint': '下次在此设备上自动登录',
  'auth.usernameHint': '字母、数字、点、连字符或下划线（3 到 32 个字符）',
  'auth.passwordHint': '至少 {min} 个字符，需同时包含字母和数字',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': '在这台电脑上注册的账户',
  'auth.registeredAccountsHint': '选择一个名字即可自动填入用户名，您只需再输入密码。',
  'auth.accountOption': '{name}（{username}）',
  'auth.accountSelected': '已选择',
  'auth.accountFilled': '已填入用户名 {username}。请输入密码。',

  // Titles, buttons and links
  'auth.createAccount': '创建账户',
  'auth.registerTitle': '注册',
  'auth.loginTitle': '登录',
  'auth.noAccountYet': '还没有账户？',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  'auth.legalConsent': '我已阅读并同意{policy}和{terms}',
  'auth.privacyConsentLink': '隐私政策',
  'auth.termsConsentLink': '使用条款',
  'auth.legalConsentRequired': '要创建账户，请勾选此框，确认你已阅读并同意隐私政策和使用条款。',
  'auth.alreadyHaveAccount': '已经有账户了？',

  // Validation and session messages
  'auth.passwordsMismatch': '两次输入的密码不一致',
  'auth.loginRequired': '请先登录，然后再继续前往所请求的页面。',
  'auth.sessionExpired': '您的会话已过期，请重新登录。',
  'auth.sessionEnded': '您的会话已结束，请重新登录。',
  'auth.loggedOut': '您已退出日记。',
  'auth.welcomeBack': '{firstName}，您好，您已成功登录。',
  'auth.accountCreated': '您的账户已创建。欢迎您，{firstName}！',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': '忘记密码？',
  'auth.forgot.title': '忘记密码',
  'auth.forgot.intro': '请输入您注册时使用的电子邮箱地址。我们会向其发送一个链接和一个 6 位验证码，供您设置新密码。您的日记记录会保留。',
  'auth.forgot.email': '注册时使用的电子邮箱地址',
  'auth.forgot.submit': '发送重置链接',
  'auth.forgot.sendAgain': '重新发送',
  'auth.forgot.sent': '如果该地址已注册，我们已向其发送了一个链接和一个验证码。',
  'auth.forgot.sentNext': '链接和验证码在 30 分钟内有效，且只能使用一次。如果几分钟内仍未收到邮件，请同时查看垃圾邮件文件夹。',
  'auth.forgot.notAvailable': '此日记尚未设置通过电子邮件重置密码。这台电脑的所有者账户可以在“设置”的“用于重置密码的电子邮件”卡片中进行设置。',
  'auth.forgot.haveCode': '输入邮件中的验证码',
  'auth.forgot.backToLogin': '返回登录',
  'auth.reset.title': '重置密码',
  'auth.reset.introLink': '请为您的账户设置新密码。您的日记记录会保留，所有设备上的登录都将退出。',
  'auth.reset.introCode': '请输入注册时使用的电子邮箱地址和邮件中的 6 位验证码，然后设置新密码。您的日记记录会保留。',
  'auth.reset.code': '邮件中的验证码',
  'auth.reset.codeHint': '6 位数字',
  'auth.reset.codeInvalid': '验证码为 6 位数字。',
  'auth.reset.newPassword': '新密码',
  'auth.reset.confirmPassword': '确认新密码',
  'auth.reset.submit': '保存新密码',
  'auth.reset.done': '您的密码已更改，所有设备上的登录均已退出。请使用新密码登录。',
  'auth.reset.useCode': '改用邮件中的验证码',
  'auth.reset.requestNew': '重新获取链接',
};
export default messages;
