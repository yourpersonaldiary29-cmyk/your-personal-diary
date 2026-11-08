/** hi - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'और',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'छोड़ें - बस देखना है',
  'mobile.guest.skipHint': 'नमूना डेटा के साथ ऐप देखें। आप जो लिखेंगे वह सहेजा नहीं जाएगा।',
  'mobile.guest.started': 'टूर मोड: यह नमूना डेटा है। आप जो लिखेंगे वह सहेजा नहीं जाएगा।',
  'mobile.guest.name': 'अतिथि',
  'mobile.guest.banner': 'टूर मोड - आप जो लिखेंगे वह सहेजा नहीं जाएगा।',
  'mobile.guest.createAccount': 'खाता बनाएँ',
  'mobile.guest.endTour': 'टूर समाप्त करें',
  'mobile.guest.ended': 'टूर समाप्त हो गया।',
  'mobile.guest.unavailable': 'इस संस्करण में टूर मोड उपलब्ध नहीं है।',
  'mobile.guest.settingsTitle': 'टूर मोड',
  'mobile.guest.settingsText': 'खाता, सुरक्षा और बैकअप की सेटिंग्स टूर मोड में उपलब्ध नहीं हैं। इनका उपयोग करने के लिए खाता बनाएँ।',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'डिवाइस में सहेजें',
  'mobile.files.share': 'साझा करें',
  'mobile.files.saved': 'डिवाइस में सहेजा गया: {fileName}',
  'mobile.files.shared': 'साझा किया गया: {fileName}',
  'mobile.files.openedBackup': 'एक बैकअप फ़ाइल खोली गई: {fileName}। उसे जाँचें, उसका पासवर्ड डालें और पुनर्स्थापना की पुष्टि करें।',
  'mobile.files.readFailed': 'खोली गई फ़ाइल पढ़ी नहीं जा सकी।',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'आदतों के रिमाइंडर',
  'mobile.reminders.channelDescription': 'आपकी आदतों के लिए तय किए गए समय पर रिमाइंडर।',
  'mobile.reminders.genericBody': 'आपकी किसी आदत का समय हो गया है।',
  'mobile.reminders.permissionText': 'ऐप बंद होने पर भी याद दिलाने के लिए फ़ोन को Your Personal Diary की सूचनाओं की अनुमति देनी होगी। रिमाइंडर फ़ोन में ही बनते हैं - कुछ भी बाहर नहीं जाता।',
  'mobile.reminders.allow': 'सूचनाओं की अनुमति दें',
  'mobile.reminders.granted': 'सूचनाओं की अनुमति है। ऐप बंद होने पर भी रिमाइंडर आते हैं, आमतौर पर तय समय के कुछ मिनटों के भीतर।',
  'mobile.reminders.denied': 'इस ऐप के लिए सूचनाएँ बंद हैं। जब तक आप उन्हें फ़ोन की सेटिंग में चालू नहीं करते (ऐप्स → Your Personal Diary → सूचनाएँ), रिमाइंडर केवल ऐप खुला होने पर दिखेंगे।',
  'mobile.reminders.showNames': 'सूचनाओं में आदतों के नाम दिखाएँ',
  'mobile.reminders.showNamesHint': 'बंद: सूचना केवल यह बताती है कि किसी आदत का समय हो गया है। चालू: आदत का नाम दिखता है - लॉक स्क्रीन पर भी।',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'ऐप से बाहर जाने पर लॉक करें',
  'mobile.security.lockOnLeaveHint': 'दूसरे ऐप पर जाने या स्क्रीन बंद होने पर डायरी लॉक हो जाती है; आपका पासवर्ड उसे फिर खोलता है।',
  'mobile.security.privacyScreen': 'हाल के ऐप्स में सामग्री छिपाएँ और स्क्रीनशॉट रोकें',
  'mobile.security.privacyScreenHint': 'हाल के ऐप्स की स्क्रीन में ऐप एक खाली कार्ड की तरह दिखता है और उसके स्क्रीनशॉट रोके जाते हैं।',
  'mobile.security.biometric': 'फ़िंगरप्रिंट या चेहरे से अनलॉक करें',
  'mobile.security.biometricHint': 'केवल लॉक स्क्रीन के लिए। साइन इन और संवेदनशील बदलावों की पुष्टि के लिए हमेशा पासवर्ड चाहिए।',
  'mobile.security.biometricUnavailable': 'इस फ़ोन में फ़िंगरप्रिंट या चेहरे से अनलॉक सेट नहीं है।',
  'mobile.security.saved': 'सेटिंग सहेजी गई।',
  'mobile.lock.biometric': 'फ़िंगरप्रिंट या चेहरे से अनलॉक करें',
  'mobile.lock.biometricTitle': 'Your Personal Diary अनलॉक करें',
  'mobile.lock.usePassword': 'पासवर्ड इस्तेमाल करें',
  'mobile.lock.biometricFailed': 'बायोमेट्रिक अनलॉक काम नहीं कर सका। अपना पासवर्ड डालें।',
};
export default messages;
