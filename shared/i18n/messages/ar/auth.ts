/** ar - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'الاسم الأول',
  'auth.lastName': 'اسم العائلة',
  'auth.username': 'اسم المستخدم',
  'auth.email': 'البريد الإلكتروني',
  'auth.emailHint': 'يُستخدم لتسجيل الدخول ولإعادة تعيين كلمة مرور منسية',
  'auth.emailInvalid': 'عنوان البريد الإلكتروني غير صالح',
  'auth.emailTaken': 'خطأ: عنوان البريد الإلكتروني هذا مسجَّل بالفعل.',
  'auth.usernameTaken': 'خطأ: اسم المستخدم هذا مستخدم بالفعل. يُرجى اختيار اسم آخر.',
  'auth.emailNotSet': 'غير محدد',
  'auth.usernameOrEmail': 'اسم المستخدم أو البريد الإلكتروني',
  'auth.password': 'كلمة المرور',
  'auth.confirmPassword': 'تأكيد كلمة المرور',
  'auth.rememberMe': 'تذكّرني',
  'auth.rememberMeHint': 'تسجيل الدخول تلقائيًا في المرة القادمة على هذا الجهاز',
  'auth.usernameHint': 'أحرف أو أرقام أو نقطة أو شرطة أو شرطة سفلية (من 3 إلى 32 حرفًا)',
  'auth.passwordHint': '{min} أحرف على الأقل، تجمع بين الحروف والأرقام',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'الحسابات المسجّلة على هذا الحاسوب',
  'auth.registeredAccountsHint': 'اختيار اسم يملأ اسم المستخدم تلقائيًا؛ ولا يتبقى سوى إدخال كلمة المرور.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'محدد',
  'auth.accountFilled': 'تم ملء اسم المستخدم {username}. يُرجى إدخال كلمة المرور.',

  // Titles, buttons and links
  'auth.createAccount': 'إنشاء حساب',
  'auth.registerTitle': 'إنشاء حساب',
  'auth.loginTitle': 'تسجيل الدخول',
  'auth.noAccountYet': 'ليس لديك حساب بعد؟',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  'auth.legalConsent': 'قرأتُ {policy} و{terms} وأوافق عليهما',
  'auth.privacyConsentLink': 'سياسة الخصوصية',
  'auth.termsConsentLink': 'شروط الاستخدام',
  'auth.legalConsentRequired': 'لإنشاء حساب، يُرجى تحديد هذا المربع لتأكيد أنك قرأت سياسة الخصوصية وشروط الاستخدام وتوافق عليهما.',
  'auth.alreadyHaveAccount': 'لديك حساب بالفعل؟',

  // Validation and session messages
  'auth.passwordsMismatch': 'كلمتا المرور غير متطابقتين',
  'auth.loginRequired': 'يُرجى تسجيل الدخول أولًا للانتقال إلى الصفحة المطلوبة.',
  'auth.sessionExpired': 'انتهت صلاحية جلستك. يُرجى تسجيل الدخول مرة أخرى.',
  'auth.sessionEnded': 'انتهت جلستك. يُرجى تسجيل الدخول مرة أخرى.',
  'auth.loggedOut': 'تم تسجيل خروجك من اليوميات.',
  'auth.welcomeBack': 'مرحبًا {firstName}، تم تسجيل دخولك بنجاح.',
  'auth.accountCreated': 'تم إنشاء حسابك. أهلًا بك يا {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'نسيت كلمة المرور؟',
  'auth.forgot.title': 'نسيان كلمة المرور',
  'auth.forgot.intro':
    'يُرجى إدخال عنوان البريد الإلكتروني الذي سُجِّل به الحساب. سنرسل إليه رابطًا ورمزًا من 6 أرقام لاختيار كلمة مرور جديدة. تدويناتك في اليوميات تبقى محفوظة.',
  'auth.forgot.email': 'البريد الإلكتروني الذي سُجِّل به الحساب',
  'auth.forgot.submit': 'إرسال رابط إعادة التعيين',
  'auth.forgot.sendAgain': 'إعادة الإرسال',
  'auth.forgot.sent': 'إذا كان هذا العنوان مسجَّلًا، فقد أرسلنا إليه رابطًا ورمزًا.',
  'auth.forgot.sentNext':
    'الرابط والرمز صالحان لمدة 30 دقيقة ولاستخدام واحد فقط. إذا لم تصل الرسالة خلال بضع دقائق، يُرجى التحقق من مجلد الرسائل غير المرغوب فيها أيضًا.',
  'auth.forgot.notAvailable':
    'لم تُعَدّ بعدُ إعادة تعيين كلمة المرور عبر البريد الإلكتروني في هذه اليوميات. يمكن للحساب المالك لهذا الحاسوب إعدادها من الإعدادات، في بطاقة «البريد الإلكتروني لإعادة تعيين كلمة المرور».',
  'auth.forgot.haveCode': 'إدخال الرمز الوارد في الرسالة',
  'auth.forgot.backToLogin': 'العودة إلى تسجيل الدخول',
  'auth.reset.title': 'إعادة تعيين كلمة المرور',
  'auth.reset.introLink':
    'يُرجى اختيار كلمة مرور جديدة لحسابك. تدويناتك تبقى محفوظة، وسيُسجَّل الخروج من جميع الأجهزة.',
  'auth.reset.introCode':
    'يُرجى إدخال البريد الإلكتروني الذي سُجِّل به الحساب والرمز المكوّن من 6 أرقام الوارد في الرسالة، ثم اختيار كلمة مرور جديدة. تدويناتك تبقى محفوظة.',
  'auth.reset.code': 'الرمز الوارد في الرسالة',
  'auth.reset.codeHint': '6 أرقام',
  'auth.reset.codeInvalid': 'يتكوّن الرمز من 6 أرقام.',
  'auth.reset.newPassword': 'كلمة المرور الجديدة',
  'auth.reset.confirmPassword': 'تأكيد كلمة المرور الجديدة',
  'auth.reset.submit': 'حفظ كلمة المرور الجديدة',
  'auth.reset.done': 'تم تغيير كلمة المرور وتسجيل الخروج من جميع الأجهزة. يُرجى تسجيل الدخول بكلمة المرور الجديدة.',
  'auth.reset.useCode': 'استخدام الرمز الوارد في الرسالة بدلًا من ذلك',
  'auth.reset.requestNew': 'طلب رابط جديد',
};
export default messages;
