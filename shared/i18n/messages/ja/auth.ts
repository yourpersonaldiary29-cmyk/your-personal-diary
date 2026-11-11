/** ja - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': '名',
  'auth.lastName': '姓',
  'auth.username': 'ユーザー名',
  'auth.email': 'メールアドレス',
  'auth.emailHint': 'ログインと、忘れたパスワードの再設定に使います',
  'auth.emailInvalid': 'メールアドレスの形式が正しくありません',
  'auth.emailTaken': 'エラー：このメールアドレスはすでに登録されています。',
  'auth.usernameTaken': 'エラー：このユーザー名はすでに使われています。別のユーザー名を選んでください。',
  'auth.emailNotSet': '未設定',
  'auth.usernameOrEmail': 'ユーザー名またはメールアドレス',
  'auth.password': 'パスワード',
  'auth.confirmPassword': 'パスワード（確認）',
  'auth.rememberMe': 'ログイン状態を保持する',
  'auth.rememberMeHint': '次回からこのデバイスで自動的にログインします',
  'auth.usernameHint': '英字、数字、ピリオド、ハイフン、アンダースコア（3〜32文字）',
  'auth.passwordHint': '英字と数字を含む{min}文字以上',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'このパソコンに登録されているアカウント',
  'auth.registeredAccountsHint': '名前を選ぶとユーザー名が入力されます。あとはパスワードを入力するだけです。',
  'auth.accountOption': '{name}（{username}）',
  'auth.accountSelected': '選択中',
  'auth.accountFilled': 'ユーザー名「{username}」を入力しました。パスワードを入力してください。',

  // Titles, buttons and links
  'auth.createAccount': 'アカウントを作成',
  'auth.registerTitle': '新規登録',
  'auth.loginTitle': 'ログイン',
  'auth.noAccountYet': 'アカウントをお持ちでない方',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  'auth.legalConsent': '{policy}と{terms}を読み、内容に同意します',
  'auth.privacyConsentLink': 'プライバシーポリシー',
  'auth.termsConsentLink': '利用規約',
  'auth.legalConsentRequired': 'アカウントを作成するには、このボックスにチェックを入れて、プライバシーポリシーと利用規約を読み、内容に同意したことを確認してください。',
  'auth.alreadyHaveAccount': 'すでにアカウントをお持ちの方',

  // Validation and session messages
  'auth.passwordsMismatch': 'パスワードが一致しません',
  'auth.loginRequired': '目的のページに進むには、先にログインしてください。',
  'auth.sessionExpired': 'セッションの有効期限が切れました。もう一度ログインしてください。',
  'auth.sessionEnded': 'セッションが終了しました。もう一度ログインしてください。',
  'auth.loggedOut': '日記からログアウトしました。',
  'auth.welcomeBack': 'こんにちは、{firstName}さん。ログインしました。',
  'auth.accountCreated': 'アカウントを作成しました。ようこそ、{firstName}さん！',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'パスワードをお忘れですか？',
  'auth.forgot.title': 'パスワードを忘れた場合',
  'auth.forgot.intro': '登録したメールアドレスを入力してください。新しいパスワードを設定するためのリンクと6桁のコードをお送りします。日記の記録はそのまま残ります。',
  'auth.forgot.email': '登録したメールアドレス',
  'auth.forgot.submit': '再設定リンクを送信',
  'auth.forgot.sendAgain': 'もう一度送信',
  'auth.forgot.sent': 'このアドレスが登録されている場合は、リンクとコードを送信しました。',
  'auth.forgot.sentNext': 'リンクとコードの有効期限は30分で、1回だけ使えます。数分たってもメールが届かない場合は、迷惑メールフォルダも確認してください。',
  'auth.forgot.notAvailable': 'この日記では、メールによるパスワードの再設定がまだ設定されていません。このパソコンの所有者のアカウントが、設定の「パスワード再設定用のメール」カードで設定できます。',
  'auth.forgot.haveCode': 'メールに記載されたコードを入力',
  'auth.forgot.backToLogin': 'ログインに戻る',
  'auth.reset.title': 'パスワードの再設定',
  'auth.reset.introLink': 'アカウントの新しいパスワードを設定してください。日記の記録はそのまま残り、すべてのデバイスでログアウトされます。',
  'auth.reset.introCode': '登録したメールアドレスとメールに記載された6桁のコードを入力し、新しいパスワードを設定してください。日記の記録はそのまま残ります。',
  'auth.reset.code': 'メールに記載されたコード',
  'auth.reset.codeHint': '6桁の数字',
  'auth.reset.codeInvalid': 'コードは6桁の数字です。',
  'auth.reset.newPassword': '新しいパスワード',
  'auth.reset.confirmPassword': '新しいパスワード（確認）',
  'auth.reset.submit': '新しいパスワードを保存',
  'auth.reset.done': 'パスワードを変更し、すべてのデバイスでログアウトしました。新しいパスワードでログインしてください。',
  'auth.reset.useCode': '代わりにメールのコードを使う',
  'auth.reset.requestNew': '新しいリンクを請求',
};
export default messages;
