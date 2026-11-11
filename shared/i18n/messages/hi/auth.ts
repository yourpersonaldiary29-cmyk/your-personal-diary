/** hi - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'पहला नाम',
  'auth.lastName': 'उपनाम',
  'auth.username': 'यूज़रनेम',
  'auth.email': 'ई-मेल',
  'auth.emailHint': 'लॉग इन करने और भूला हुआ पासवर्ड रीसेट करने के लिए इस्तेमाल होता है',
  'auth.emailInvalid': 'ई-मेल पता मान्य नहीं है',
  'auth.emailTaken': 'त्रुटि: यह ई-मेल पता पहले से पंजीकृत है।',
  'auth.usernameTaken': 'त्रुटि: यह यूज़रनेम पहले से लिया जा चुका है। कृपया कोई दूसरा चुनें।',
  'auth.emailNotSet': 'सेट नहीं है',
  'auth.usernameOrEmail': 'यूज़रनेम या ई-मेल',
  'auth.password': 'पासवर्ड',
  'auth.confirmPassword': 'पासवर्ड की पुष्टि करें',
  'auth.rememberMe': 'मुझे याद रखें',
  'auth.rememberMeHint': 'अगली बार इस डिवाइस पर अपने आप साइन इन करें',
  'auth.usernameHint': 'अक्षर, अंक, बिंदु, हाइफ़न या अंडरस्कोर (3 से 32 वर्ण)',
  'auth.passwordHint': 'कम से कम {min} वर्ण, जिनमें अक्षर और अंक दोनों हों',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'इस कंप्यूटर पर पंजीकृत खाते',
  'auth.registeredAccountsHint': 'कोई नाम चुनने पर यूज़रनेम अपने आप भर जाता है; बस पासवर्ड दर्ज करना बाकी रहता है।',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'चुना गया',
  'auth.accountFilled': 'यूज़रनेम {username} भर दिया गया। पासवर्ड दर्ज करें।',

  // Titles, buttons and links
  'auth.createAccount': 'खाता बनाएँ',
  'auth.registerTitle': 'साइन अप',
  'auth.loginTitle': 'लॉग इन',
  'auth.noAccountYet': 'अभी तक खाता नहीं है?',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent) - ONE box for both documents
  // (docs/apple-tasks/TERMS.md): {policy} = the link auth.privacyConsentLink, {terms} = the link auth.termsConsentLink
  // (each worded to fit this sentence); auth.legalConsentRequired shows under the unticked box
  'auth.legalConsent': 'मैंने {policy} और {terms} पढ़ ली हैं और मैं इनसे सहमत हूँ',
  'auth.privacyConsentLink': 'गोपनीयता नीति',
  'auth.termsConsentLink': 'उपयोग की शर्तें',
  'auth.legalConsentRequired': 'खाता बनाने के लिए यह बॉक्स चुनें और पुष्टि करें कि आपने गोपनीयता नीति और उपयोग की शर्तें पढ़ ली हैं और आप इनसे सहमत हैं।',
  'auth.alreadyHaveAccount': 'पहले से खाता है?',

  // Validation and session messages
  'auth.passwordsMismatch': 'पासवर्ड मेल नहीं खाते',
  'auth.loginRequired': 'अनुरोधित पेज पर जाने के लिए कृपया पहले लॉग इन करें।',
  'auth.sessionExpired': 'आपके सत्र की अवधि समाप्त हो गई है। कृपया फिर से लॉग इन करें।',
  'auth.sessionEnded': 'आपका सत्र समाप्त हो गया है। कृपया फिर से लॉग इन करें।',
  'auth.loggedOut': 'आपने डायरी से लॉग आउट कर लिया है।',
  'auth.welcomeBack': 'नमस्ते {firstName}, आपने सफलतापूर्वक लॉग इन कर लिया है।',
  'auth.accountCreated': 'आपका खाता बन गया है। स्वागत है, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'पासवर्ड भूल गए?',
  'auth.forgot.title': 'पासवर्ड भूल जाने पर',
  'auth.forgot.intro':
    'वह ई-मेल पता दर्ज करें जिससे आपने पंजीकरण किया था। हम उस पर नया पासवर्ड चुनने के लिए एक लिंक और 6 अंकों का कोड भेजेंगे। आपकी डायरी की प्रविष्टियाँ सुरक्षित रहती हैं।',
  'auth.forgot.email': 'पंजीकरण वाला ई-मेल पता',
  'auth.forgot.submit': 'रीसेट लिंक भेजें',
  'auth.forgot.sendAgain': 'फिर से भेजें',
  'auth.forgot.sent': 'अगर यह पता पंजीकृत है, तो हमने उस पर एक लिंक और एक कोड भेज दिया है।',
  'auth.forgot.sentNext':
    'लिंक और कोड 30 मिनट तक मान्य हैं और केवल एक बार इस्तेमाल किए जा सकते हैं। अगर कुछ मिनटों में ई-मेल न आए, तो स्पैम फ़ोल्डर भी देखें।',
  'auth.forgot.notAvailable':
    'इस डायरी में ई-मेल से पासवर्ड रीसेट अभी सेट नहीं किया गया है। इस कंप्यूटर का स्वामी खाता इसे सेटिंग्स में "पासवर्ड रीसेट के लिए ई-मेल" कार्ड से सेट कर सकता है।',
  'auth.forgot.haveCode': 'ई-मेल वाला कोड दर्ज करें',
  'auth.forgot.backToLogin': 'लॉग इन पर वापस जाएँ',
  'auth.reset.title': 'पासवर्ड रीसेट करें',
  'auth.reset.introLink':
    'अपने खाते के लिए नया पासवर्ड चुनें। आपकी डायरी की प्रविष्टियाँ सुरक्षित रहती हैं, और सभी डिवाइस पर लॉग आउट हो जाएगा।',
  'auth.reset.introCode':
    'पंजीकरण वाला ई-मेल पता और ई-मेल में मिला 6 अंकों का कोड दर्ज करें, फिर नया पासवर्ड चुनें। आपकी डायरी की प्रविष्टियाँ सुरक्षित रहती हैं।',
  'auth.reset.code': 'ई-मेल में मिला कोड',
  'auth.reset.codeHint': '6 अंक',
  'auth.reset.codeInvalid': 'कोड 6 अंकों का होता है।',
  'auth.reset.newPassword': 'नया पासवर्ड',
  'auth.reset.confirmPassword': 'नए पासवर्ड की पुष्टि करें',
  'auth.reset.submit': 'नया पासवर्ड सहेजें',
  'auth.reset.done': 'आपका पासवर्ड बदल दिया गया है और सभी डिवाइस पर लॉग आउट हो गया है। नए पासवर्ड से लॉग इन करें।',
  'auth.reset.useCode': 'इसके बजाय ई-मेल वाला कोड इस्तेमाल करें',
  'auth.reset.requestNew': 'नया लिंक मँगवाएँ',
};
export default messages;
