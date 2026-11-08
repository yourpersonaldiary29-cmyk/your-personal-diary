/** he - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'עוד',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'דילוג - רק להסתכל',
  'mobile.guest.skipHint': 'אפשר לראות את האפליקציה עם נתוני דוגמה. מה שתכתוב לא יישמר.',
  'mobile.guest.started': 'מצב סיור: אלה נתוני דוגמה. מה שתכתוב לא יישמר.',
  'mobile.guest.name': 'אורח/ת',
  'mobile.guest.banner': 'מצב סיור - מה שתכתוב לא יישמר.',
  'mobile.guest.createAccount': 'יצירת חשבון',
  'mobile.guest.endTour': 'סיום הסיור',
  'mobile.guest.ended': 'הסיור הסתיים.',
  'mobile.guest.unavailable': 'מצב סיור אינו זמין בגרסה הזו.',
  'mobile.guest.settingsTitle': 'מצב סיור',
  'mobile.guest.settingsText': 'הגדרות החשבון, האבטחה והגיבוי אינן זמינות במצב סיור. כדי להשתמש בהן יש ליצור חשבון.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'שמירה במכשיר',
  'mobile.files.share': 'שיתוף',
  'mobile.files.saved': 'נשמר במכשיר: {fileName}',
  'mobile.files.shared': 'שותף: {fileName}',
  'mobile.files.openedBackup': 'נפתח קובץ גיבוי: {fileName}. בדקו אותו, הזינו את הסיסמה שלו ואשרו כדי לשחזר.',
  'mobile.files.readFailed': 'לא ניתן לקרוא את הקובץ שנפתח.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'תזכורות להרגלים',
  'mobile.reminders.channelDescription': 'תזכורות בשעות שקבעתם להרגלים שלכם.',
  'mobile.reminders.genericBody': 'הגיע הזמן לאחד ההרגלים שלכם.',
  'mobile.reminders.permissionText': 'כדי להזכיר לכם גם כשהאפליקציה סגורה, הטלפון צריך לאפשר התראות ל-Your Personal Diary. התזכורות נוצרות בטלפון עצמו - שום דבר לא יוצא ממנו.',
  'mobile.reminders.allow': 'אפשר התראות',
  'mobile.reminders.granted': 'ההתראות מאופשרות. התזכורות מגיעות גם כשהאפליקציה סגורה, בדרך כלל בתוך כמה דקות מהשעה שנקבעה.',
  'mobile.reminders.denied': 'ההתראות כבויות לאפליקציה הזו. עד שתדליקו אותן בהגדרות הטלפון (אפליקציות ← Your Personal Diary ← התראות), התזכורות יופיעו רק כשהאפליקציה פתוחה.',
  'mobile.reminders.showNames': 'הצגת שמות ההרגלים בהתראות',
  'mobile.reminders.showNamesHint': 'כבוי: ההתראה אומרת רק שהגיע הזמן להרגל. דלוק: שם ההרגל מוצג - גם במסך הנעילה.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'נעילה כשאני יוצא/ת מהאפליקציה',
  'mobile.security.lockOnLeaveHint': 'היומן ננעל כשעוברים לאפליקציה אחרת או כשהמסך כבה; הסיסמה פותחת אותו שוב.',
  'mobile.security.privacyScreen': 'הסתרת התוכן באפליקציות האחרונות וחסימת צילומי מסך',
  'mobile.security.privacyScreenHint': 'האפליקציה מוצגת כקלף ריק במסך האפליקציות האחרונות, וצילומי מסך שלה חסומים.',
  'mobile.security.biometric': 'פתיחה בטביעת אצבע או בזיהוי פנים',
  'mobile.security.biometricHint': 'רק למסך הנעילה. כניסה ואישור שינויים רגישים תמיד דורשים את הסיסמה.',
  'mobile.security.biometricUnavailable': 'בטלפון הזה לא מוגדרת פתיחה בטביעת אצבע או בזיהוי פנים.',
  'mobile.security.saved': 'ההגדרה נשמרה.',
  'mobile.lock.biometric': 'פתיחה בטביעת אצבע או בזיהוי פנים',
  'mobile.lock.biometricTitle': 'פתיחת Your Personal Diary',
  'mobile.lock.usePassword': 'שימוש בסיסמה',
  'mobile.lock.biometricFailed': 'הפתיחה הביומטרית לא הצליחה. הזינו את הסיסמה.',
};
export default messages;
