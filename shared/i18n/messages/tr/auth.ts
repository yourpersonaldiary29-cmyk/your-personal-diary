/** tr - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Ad',
  'auth.lastName': 'Soyad',
  'auth.username': 'Kullanıcı adı',
  'auth.email': 'E-posta',
  'auth.emailHint': 'Giriş yapmak ve unutulan bir parolayı sıfırlamak için kullanılır',
  'auth.emailInvalid': 'E-posta adresi geçerli değil',
  'auth.emailTaken': 'Hata: Bu e-posta adresi zaten kayıtlı.',
  'auth.usernameTaken': 'Hata: Bu kullanıcı adı zaten alınmış. Lütfen başka bir ad seçin.',
  'auth.emailNotSet': 'Belirlenmedi',
  'auth.usernameOrEmail': 'Kullanıcı adı veya e-posta',
  'auth.password': 'Parola',
  'auth.confirmPassword': 'Parolayı onaylayın',
  'auth.rememberMe': 'Beni hatırla',
  'auth.rememberMeHint': 'Bu cihazda bir dahaki sefere otomatik olarak giriş yap',
  'auth.usernameHint': 'Harf, rakam, nokta, kısa çizgi veya alt çizgi (3 ile 32 karakter arası)',
  'auth.passwordHint': 'En az {min} karakter; harf ve rakam içermeli',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Bu bilgisayarda kayıtlı hesaplar',
  'auth.registeredAccountsHint': 'Bir ad seçtiğinizde kullanıcı adı doldurulur; yalnızca parolayı girmeniz kalır.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'seçili',
  'auth.accountFilled': 'Kullanıcı adı ({username}) dolduruldu. Parolanızı girin.',

  // Titles, buttons and links
  'auth.createAccount': 'Hesap oluştur',
  'auth.registerTitle': 'Hesap oluştur',
  'auth.loginTitle': 'Giriş yap',
  'auth.noAccountYet': 'Henüz hesabınız yok mu?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  'auth.legalConsent': '{policy} ve {terms} okudum ve kabul ediyorum',
  'auth.privacyConsentLink': 'Gizlilik Politikasını',
  'auth.termsConsentLink': 'Kullanım Koşullarını',
  'auth.legalConsentRequired': 'Hesap oluşturmak için bu kutuyu işaretleyerek Gizlilik Politikasını ve Kullanım Koşullarını okuduğunuzu ve kabul ettiğinizi onaylayın.',
  'auth.alreadyHaveAccount': 'Zaten hesabınız var mı?',

  // Validation and session messages
  'auth.passwordsMismatch': 'Parolalar eşleşmiyor',
  'auth.loginRequired': 'İstenen sayfaya devam etmek için lütfen önce giriş yapın.',
  'auth.sessionExpired': 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.',
  'auth.sessionEnded': 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
  'auth.loggedOut': 'Günlükten çıkış yaptınız.',
  'auth.welcomeBack': 'Merhaba {firstName}, başarıyla giriş yaptınız.',
  'auth.accountCreated': 'Hesabınız oluşturuldu. Hoş geldiniz, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Parolanızı mı unuttunuz?',
  'auth.forgot.title': 'Parolamı unuttum',
  'auth.forgot.intro':
    'Hesap oluştururken kullandığınız e-posta adresini girin. Yeni bir parola seçmeniz için size bir bağlantı ve 6 haneli bir kod göndereceğiz. Günlük kayıtlarınız korunur.',
  'auth.forgot.email': 'Hesap oluştururken kullandığınız e-posta adresi',
  'auth.forgot.submit': 'Sıfırlama bağlantısı gönder',
  'auth.forgot.sendAgain': 'Yeniden gönder',
  'auth.forgot.sent': 'Bu adres kayıtlıysa, adrese bir bağlantı ve bir kod gönderdik.',
  'auth.forgot.sentNext':
    'Bağlantı ve kod 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir. E-posta birkaç dakika içinde gelmezse istenmeyen posta klasörünü de kontrol edin.',
  'auth.forgot.notAvailable':
    'Bu günlükte e-postayla parola sıfırlama henüz ayarlanmadı. Bu bilgisayarın sahibi olan hesap, bunu Ayarlar\'daki "Parola sıfırlama e-postası" kartından ayarlayabilir.',
  'auth.forgot.haveCode': 'E-postadaki kodu girin',
  'auth.forgot.backToLogin': 'Girişe dön',
  'auth.reset.title': 'Parolayı sıfırla',
  'auth.reset.introLink':
    'Hesabınız için yeni bir parola seçin. Günlük kayıtlarınız korunur ve tüm cihazlarda oturumunuz kapatılır.',
  'auth.reset.introCode':
    'Hesap oluştururken kullandığınız e-posta adresini ve e-postadaki 6 haneli kodu girin, ardından yeni bir parola seçin. Günlük kayıtlarınız korunur.',
  'auth.reset.code': 'E-postadaki kod',
  'auth.reset.codeHint': '6 hane',
  'auth.reset.codeInvalid': 'Kod 6 haneden oluşur.',
  'auth.reset.newPassword': 'Yeni parola',
  'auth.reset.confirmPassword': 'Yeni parolayı onaylayın',
  'auth.reset.submit': 'Yeni parolayı kaydet',
  'auth.reset.done': 'Parolanız değiştirildi ve tüm cihazlarda oturumunuz kapatıldı. Yeni parolanızla giriş yapın.',
  'auth.reset.useCode': 'Bunun yerine e-postadaki kodu kullan',
  'auth.reset.requestNew': 'Yeni bağlantı iste',
};
export default messages;
