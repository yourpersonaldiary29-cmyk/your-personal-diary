/** th - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'ชื่อ',
  'auth.lastName': 'นามสกุล',
  'auth.username': 'ชื่อผู้ใช้',
  'auth.email': 'อีเมล',
  'auth.emailHint': 'ใช้สำหรับเข้าสู่ระบบและรีเซ็ตรหัสผ่านที่ลืม',
  'auth.emailInvalid': 'ที่อยู่อีเมลไม่ถูกต้อง',
  'auth.emailTaken': 'ข้อผิดพลาด: ที่อยู่อีเมลนี้ลงทะเบียนไว้แล้ว',
  'auth.usernameTaken': 'ข้อผิดพลาด: ชื่อผู้ใช้นี้มีผู้ใช้แล้ว โปรดเลือกชื่ออื่น',
  'auth.emailNotSet': 'ยังไม่ได้ตั้งค่า',
  'auth.usernameOrEmail': 'ชื่อผู้ใช้หรืออีเมล',
  'auth.password': 'รหัสผ่าน',
  'auth.confirmPassword': 'ยืนยันรหัสผ่าน',
  'auth.rememberMe': 'จดจำฉันไว้',
  'auth.rememberMeHint': 'ลงชื่อเข้าใช้โดยอัตโนมัติในครั้งถัดไปบนอุปกรณ์นี้',
  'auth.usernameHint': 'ตัวอักษร ตัวเลข จุด ขีดกลาง หรือขีดล่าง (3 ถึง 32 ตัวอักษร)',
  'auth.passwordHint': 'อย่างน้อย {min} ตัวอักษร โดยมีทั้งตัวอักษรและตัวเลข',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'บัญชีที่ลงทะเบียนไว้บนคอมพิวเตอร์เครื่องนี้',
  'auth.registeredAccountsHint': 'เมื่อเลือกชื่อ ระบบจะกรอกชื่อผู้ใช้ให้ เหลือเพียงใส่รหัสผ่าน',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'เลือกอยู่',
  'auth.accountFilled': 'กรอกชื่อผู้ใช้ {username} แล้ว โปรดใส่รหัสผ่าน',

  // Titles, buttons and links
  'auth.createAccount': 'สร้างบัญชี',
  'auth.registerTitle': 'สมัครใช้งาน',
  'auth.loginTitle': 'เข้าสู่ระบบ',
  'auth.noAccountYet': 'ยังไม่มีบัญชีใช่ไหม?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent): {policy} = the link
  // auth.privacyConsentLink (worded to fit this sentence); auth.privacyConsentRequired shows under the unticked box
  'auth.privacyConsent': 'ฉันได้อ่านและยอมรับ{policy}แล้ว',
  'auth.privacyConsentLink': 'นโยบายความเป็นส่วนตัว',
  'auth.privacyConsentRequired': 'หากต้องการสร้างบัญชี ให้ทำเครื่องหมายในช่องนี้เพื่อยืนยันว่าคุณได้อ่านและยอมรับนโยบายความเป็นส่วนตัวแล้ว',
  'auth.alreadyHaveAccount': 'มีบัญชีอยู่แล้วใช่ไหม?',

  // Validation and session messages
  'auth.passwordsMismatch': 'รหัสผ่านไม่ตรงกัน',
  'auth.loginRequired': 'โปรดเข้าสู่ระบบก่อนเพื่อไปยังหน้าที่ต้องการ',
  'auth.sessionExpired': 'เซสชันของคุณหมดอายุแล้ว โปรดเข้าสู่ระบบอีกครั้ง',
  'auth.sessionEnded': 'เซสชันของคุณสิ้นสุดแล้ว โปรดเข้าสู่ระบบอีกครั้ง',
  'auth.loggedOut': 'คุณออกจากระบบไดอารี่แล้ว',
  'auth.welcomeBack': 'สวัสดี {firstName} คุณเข้าสู่ระบบสำเร็จแล้ว',
  'auth.accountCreated': 'สร้างบัญชีของคุณเรียบร้อยแล้ว ยินดีต้อนรับ {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'ลืมรหัสผ่าน?',
  'auth.forgot.title': 'ลืมรหัสผ่าน',
  'auth.forgot.intro':
    'ใส่ที่อยู่อีเมลที่คุณใช้ลงทะเบียน เราจะส่งลิงก์และรหัส 6 หลักไปให้เพื่อตั้งรหัสผ่านใหม่ บันทึกในไดอารี่ของคุณจะยังอยู่ครบ',
  'auth.forgot.email': 'อีเมลที่ใช้ลงทะเบียน',
  'auth.forgot.submit': 'ส่งลิงก์รีเซ็ต',
  'auth.forgot.sendAgain': 'ส่งอีกครั้ง',
  'auth.forgot.sent': 'หากที่อยู่นี้ลงทะเบียนไว้ เราได้ส่งลิงก์และรหัสไปที่อยู่นั้นแล้ว',
  'auth.forgot.sentNext':
    'ลิงก์และรหัสใช้ได้ 30 นาทีและใช้ได้เพียงครั้งเดียว หากไม่ได้รับอีเมลภายในไม่กี่นาที โปรดตรวจสอบโฟลเดอร์สแปมด้วย',
  'auth.forgot.notAvailable':
    'ไดอารี่นี้ยังไม่ได้ตั้งค่าการรีเซ็ตรหัสผ่านทางอีเมล บัญชีเจ้าของคอมพิวเตอร์เครื่องนี้ตั้งค่าได้ในการตั้งค่า ที่การ์ด "อีเมลสำหรับรีเซ็ตรหัสผ่าน"',
  'auth.forgot.haveCode': 'ใส่รหัสจากอีเมล',
  'auth.forgot.backToLogin': 'กลับไปที่การเข้าสู่ระบบ',
  'auth.reset.title': 'รีเซ็ตรหัสผ่าน',
  'auth.reset.introLink':
    'ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ บันทึกในไดอารี่ของคุณจะยังอยู่ครบ และทุกอุปกรณ์จะถูกออกจากระบบ',
  'auth.reset.introCode':
    'ใส่อีเมลที่ใช้ลงทะเบียนและรหัส 6 หลักจากอีเมล แล้วตั้งรหัสผ่านใหม่ บันทึกในไดอารี่ของคุณจะยังอยู่ครบ',
  'auth.reset.code': 'รหัสจากอีเมล',
  'auth.reset.codeHint': 'ตัวเลข 6 หลัก',
  'auth.reset.codeInvalid': 'รหัสมีตัวเลข 6 หลัก',
  'auth.reset.newPassword': 'รหัสผ่านใหม่',
  'auth.reset.confirmPassword': 'ยืนยันรหัสผ่านใหม่',
  'auth.reset.submit': 'บันทึกรหัสผ่านใหม่',
  'auth.reset.done': 'เปลี่ยนรหัสผ่านแล้วและออกจากระบบในทุกอุปกรณ์แล้ว โปรดเข้าสู่ระบบด้วยรหัสผ่านใหม่',
  'auth.reset.useCode': 'ใช้รหัสจากอีเมลแทน',
  'auth.reset.requestNew': 'ขอลิงก์ใหม่',
};
export default messages;
