/** he - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'שם פרטי',
  'auth.lastName': 'שם משפחה',
  'auth.username': 'שם משתמש',
  'auth.email': 'דואר אלקטרוני',
  'auth.emailHint': 'משמשת להתחברות ולאיפוס סיסמה שנשכחה',
  'auth.emailInvalid': 'כתובת הדוא״ל אינה תקינה',
  'auth.emailTaken': 'שגיאה: כתובת המייל הזו כבר רשומה במערכת.',
  'auth.usernameTaken': 'שגיאה: שם המשתמש הזה כבר תפוס. יש לבחור שם אחר.',
  'auth.emailNotSet': 'לא הוגדרה',
  'auth.usernameOrEmail': 'שם משתמש או דוא״ל',
  'auth.password': 'סיסמה',
  'auth.confirmPassword': 'אישור סיסמה',
  'auth.rememberMe': 'זכור אותי',
  'auth.rememberMeHint': 'התחברות אוטומטית בפעם הבאה במכשיר הזה',
  'auth.usernameHint': 'אותיות, ספרות, נקודה, מקף או קו תחתון (3 עד 32 תווים)',
  'auth.passwordHint': 'לפחות {min} תווים, עם אותיות וספרות',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'משתמשים רשומים במחשב זה',
  'auth.registeredAccountsHint': 'בחירת שם ממלאת את שם המשתמש; נשאר רק להזין סיסמה.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'נבחר',
  'auth.accountFilled': 'שם המשתמש {username} מולא. יש להזין סיסמה.',

  // Titles, buttons and links
  'auth.createAccount': 'צור חשבון',
  'auth.registerTitle': 'הרשמה',
  'auth.loginTitle': 'התחברות',
  'auth.noAccountYet': 'עדיין אין לך חשבון?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  'auth.legalConsent': 'קראתי את {policy} ואת {terms} והסכמתי להם',
  'auth.privacyConsentLink': 'מדיניות הפרטיות',
  'auth.termsConsentLink': 'תנאי השימוש',
  'auth.legalConsentRequired': 'כדי ליצור חשבון, יש לסמן את התיבה ובכך לאשר שקראת את מדיניות הפרטיות ואת תנאי השימוש ושהסכמת להם.',
  'auth.alreadyHaveAccount': 'כבר יש לך חשבון?',

  // Validation and session messages
  'auth.passwordsMismatch': 'הסיסמאות אינן זהות',
  'auth.loginRequired': 'כדי להמשיך לעמוד המבוקש יש להתחבר תחילה.',
  'auth.sessionExpired': 'פג תוקף ההתחברות. יש להתחבר מחדש.',
  'auth.sessionEnded': 'ההתחברות הסתיימה. יש להתחבר מחדש.',
  'auth.loggedOut': 'התנתקת מהיומן.',
  'auth.welcomeBack': 'שלום {firstName}, התחברת בהצלחה.',
  'auth.accountCreated': 'החשבון נוצר. ברוכים הבאים, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'שכחת את הסיסמה?',
  'auth.forgot.title': 'שכחתי סיסמה',
  'auth.forgot.intro':
    'יש להזין את כתובת הדוא״ל שאיתה נרשמת. נשלח אליה קישור וקוד בן 6 ספרות לבחירת סיסמה חדשה. רשומות היומן שלך נשמרות.',
  'auth.forgot.email': 'כתובת הדוא״ל שאיתה נרשמת',
  'auth.forgot.submit': 'שליחת קישור לאיפוס',
  'auth.forgot.sendAgain': 'שליחה חוזרת',
  'auth.forgot.sent': 'אם הכתובת הזו רשומה, שלחנו אליה קישור וקוד.',
  'auth.forgot.sentNext':
    'הקישור והקוד בתוקף ל-30 דקות ולשימוש אחד בלבד. אם המייל לא מגיע תוך כמה דקות, כדאי לבדוק גם בתיקיית הספאם.',
  'auth.forgot.notAvailable':
    'איפוס סיסמה בדוא״ל עדיין לא הוגדר ביומן הזה. החשבון שמנהל את המחשב יכול להגדיר אותו בהגדרות, בכרטיס "דואר אלקטרוני לאיפוס סיסמה".',
  'auth.forgot.haveCode': 'הזנת הקוד מהמייל',
  'auth.forgot.backToLogin': 'חזרה להתחברות',
  'auth.reset.title': 'איפוס סיסמה',
  'auth.reset.introLink': 'יש לבחור סיסמה חדשה לחשבון. רשומות היומן שלך נשמרות, והחשבון ינותק בכל המכשירים.',
  'auth.reset.introCode':
    'יש להזין את כתובת הדוא״ל שאיתה נרשמת ואת הקוד בן 6 הספרות מהמייל, ואז לבחור סיסמה חדשה. רשומות היומן שלך נשמרות.',
  'auth.reset.code': 'הקוד מהמייל',
  'auth.reset.codeHint': '6 ספרות',
  'auth.reset.codeInvalid': 'הקוד מורכב מ-6 ספרות.',
  'auth.reset.newPassword': 'סיסמה חדשה',
  'auth.reset.confirmPassword': 'אישור הסיסמה החדשה',
  'auth.reset.submit': 'שמירת הסיסמה החדשה',
  'auth.reset.done': 'הסיסמה הוחלפה והחשבון נותק בכל המכשירים. אפשר להתחבר עם הסיסמה החדשה.',
  'auth.reset.useCode': 'שימוש בקוד מהמייל במקום זאת',
  'auth.reset.requestNew': 'בקשת קישור חדש',
};
export default messages;
