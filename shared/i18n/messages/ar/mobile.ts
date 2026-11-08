/** ar - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'المزيد',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'تخطٍّ - أريد إلقاء نظرة فقط',
  'mobile.guest.skipHint': 'استكشف التطبيق ببيانات تجريبية. لن يُحفظ أي شيء تكتبه.',
  'mobile.guest.started': 'وضع الجولة: هذه بيانات تجريبية. لن يُحفظ أي شيء تكتبه.',
  'mobile.guest.name': 'ضيفنا',
  'mobile.guest.banner': 'وضع الجولة - لن يُحفظ أي شيء تكتبه.',
  'mobile.guest.createAccount': 'إنشاء حساب',
  'mobile.guest.endTour': 'إنهاء الجولة',
  'mobile.guest.ended': 'انتهت الجولة.',
  'mobile.guest.unavailable': 'وضع الجولة غير متاح في هذا الإصدار.',
  'mobile.guest.settingsTitle': 'وضع الجولة',
  'mobile.guest.settingsText': 'إعدادات الحساب والأمان والنسخ الاحتياطي غير متاحة في وضع الجولة. أنشئ حسابًا لاستخدامها.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'حفظ على الجهاز',
  'mobile.files.share': 'مشاركة',
  'mobile.files.saved': 'تم الحفظ على الجهاز: {fileName}',
  'mobile.files.shared': 'تمت المشاركة: {fileName}',
  'mobile.files.openedBackup': 'تم فتح ملف نسخة احتياطية: {fileName}. تحقق منه وأدخل كلمة مروره وأكّد للاستعادة.',
  'mobile.files.readFailed': 'تعذّرت قراءة الملف المفتوح.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'تذكيرات العادات',
  'mobile.reminders.channelDescription': 'تذكيرات في الأوقات التي حددتها لعاداتك.',
  'mobile.reminders.genericBody': 'حان وقت إحدى عاداتك.',
  'mobile.reminders.permissionText': 'لكي يذكّرك الهاتف حتى عندما يكون التطبيق مغلقًا، يجب أن يسمح بالإشعارات لتطبيق Your Personal Diary. تُنشأ التذكيرات على الهاتف نفسه - ولا يخرج منه أي شيء.',
  'mobile.reminders.allow': 'السماح بالإشعارات',
  'mobile.reminders.granted': 'الإشعارات مسموح بها. تصل التذكيرات حتى عندما يكون التطبيق مغلقًا، عادةً خلال دقائق قليلة من الوقت المحدد.',
  'mobile.reminders.denied': 'الإشعارات متوقفة لهذا التطبيق. إلى أن تفعّلها في إعدادات الهاتف (التطبيقات ← Your Personal Diary ← الإشعارات)، ستظهر التذكيرات فقط عندما يكون التطبيق مفتوحًا.',
  'mobile.reminders.showNames': 'إظهار أسماء العادات في الإشعارات',
  'mobile.reminders.showNamesHint': 'متوقف: يذكر الإشعار فقط أن وقت إحدى العادات قد حان. مفعّل: يظهر اسم العادة - وعلى شاشة القفل أيضًا.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'القفل عند مغادرة التطبيق',
  'mobile.security.lockOnLeaveHint': 'تُقفل اليوميات عند الانتقال إلى تطبيق آخر أو انطفاء الشاشة؛ وكلمة مرورك تفتحها من جديد.',
  'mobile.security.privacyScreen': 'إخفاء المحتوى في التطبيقات الأخيرة ومنع لقطات الشاشة',
  'mobile.security.privacyScreenHint': 'يظهر التطبيق كبطاقة فارغة في شاشة التطبيقات الأخيرة، وتُمنع لقطات الشاشة له.',
  'mobile.security.biometric': 'فتح القفل ببصمة الإصبع أو الوجه',
  'mobile.security.biometricHint': 'لشاشة القفل فقط. تسجيل الدخول وتأكيد التغييرات الحساسة يتطلبان كلمة المرور دائمًا.',
  'mobile.security.biometricUnavailable': 'لم يُعدّ فتح القفل ببصمة الإصبع أو الوجه على هذا الهاتف.',
  'mobile.security.saved': 'تم حفظ الإعداد.',
  'mobile.lock.biometric': 'فتح القفل ببصمة الإصبع أو الوجه',
  'mobile.lock.biometricTitle': 'فتح قفل Your Personal Diary',
  'mobile.lock.usePassword': 'استخدام كلمة المرور',
  'mobile.lock.biometricFailed': 'لم ينجح فتح القفل البيومتري. أدخل كلمة المرور.',
};
export default messages;
