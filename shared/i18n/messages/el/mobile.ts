/** el - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Περισσότερα',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Παράλειψη - θέλω απλώς να ρίξω μια ματιά',
  'mobile.guest.skipHint': 'Δες την εφαρμογή με δειγματικά δεδομένα. Τίποτα από όσα γράφεις δεν αποθηκεύεται.',
  'mobile.guest.started': 'Λειτουργία περιήγησης: βλέπεις δειγματικά δεδομένα. Τίποτα από όσα γράφεις δεν αποθηκεύεται.',
  'mobile.guest.name': 'επισκέπτη',
  'mobile.guest.banner': 'Λειτουργία περιήγησης - τίποτα από όσα γράφεις δεν αποθηκεύεται.',
  'mobile.guest.createAccount': 'Δημιουργία λογαριασμού',
  'mobile.guest.endTour': 'Τέλος περιήγησης',
  'mobile.guest.ended': 'Η περιήγηση ολοκληρώθηκε.',
  'mobile.guest.unavailable': 'Η λειτουργία περιήγησης δεν είναι διαθέσιμη σε αυτή την έκδοση.',
  'mobile.guest.settingsTitle': 'Λειτουργία περιήγησης',
  'mobile.guest.settingsText':
    'Οι ρυθμίσεις λογαριασμού, ασφάλειας και αντιγράφων ασφαλείας δεν είναι διαθέσιμες στη λειτουργία περιήγησης. Δημιούργησε λογαριασμό για να τις χρησιμοποιήσεις.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Αποθήκευση στη συσκευή',
  'mobile.files.share': 'Κοινοποίηση',
  'mobile.files.saved': 'Αποθηκεύτηκε στη συσκευή: {fileName}',
  'mobile.files.shared': 'Κοινοποιήθηκε: {fileName}',
  'mobile.files.openedBackup': 'Ανοίχτηκε αρχείο αντιγράφου ασφαλείας: {fileName}. Ελέγξτε το, πληκτρολογήστε τον κωδικό του και επιβεβαιώστε για επαναφορά.',
  'mobile.files.readFailed': 'Δεν ήταν δυνατή η ανάγνωση του αρχείου που ανοίχτηκε.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Υπενθυμίσεις συνηθειών',
  'mobile.reminders.channelDescription': 'Υπενθυμίσεις στις ώρες που ορίσατε για τις συνήθειές σας.',
  'mobile.reminders.genericBody': 'Ώρα για μία από τις συνήθειές σας.',
  'mobile.reminders.permissionText': 'Για να σας υπενθυμίζει και όταν η εφαρμογή είναι κλειστή, το τηλέφωνο πρέπει να επιτρέπει τις ειδοποιήσεις του Your Personal Diary. Οι υπενθυμίσεις δημιουργούνται στο ίδιο το τηλέφωνο - τίποτα δεν φεύγει από αυτό.',
  'mobile.reminders.allow': 'Να επιτρέπονται οι ειδοποιήσεις',
  'mobile.reminders.granted': 'Οι ειδοποιήσεις επιτρέπονται. Οι υπενθυμίσεις φτάνουν ακόμη κι όταν η εφαρμογή είναι κλειστή, συνήθως μέσα σε λίγα λεπτά από την ορισμένη ώρα.',
  'mobile.reminders.denied': 'Οι ειδοποιήσεις είναι απενεργοποιημένες για αυτήν την εφαρμογή. Μέχρι να τις ενεργοποιήσετε στις ρυθμίσεις του τηλεφώνου (Εφαρμογές → Your Personal Diary → Ειδοποιήσεις), οι υπενθυμίσεις εμφανίζονται μόνο όταν η εφαρμογή είναι ανοιχτή.',
  'mobile.reminders.showNames': 'Εμφάνιση ονομάτων συνηθειών στις ειδοποιήσεις',
  'mobile.reminders.showNamesHint': 'Ανενεργό: η ειδοποίηση λέει μόνο ότι είναι ώρα για μια συνήθεια. Ενεργό: εμφανίζεται το όνομα της συνήθειας - και στην οθόνη κλειδώματος.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Κλείδωμα όταν φεύγω από την εφαρμογή',
  'mobile.security.lockOnLeaveHint': 'Το ημερολόγιο κλειδώνει όταν μεταβαίνετε σε άλλη εφαρμογή ή σβήνει η οθόνη· ο κωδικός σας το ανοίγει ξανά.',
  'mobile.security.privacyScreen': 'Απόκρυψη περιεχομένου στις πρόσφατες εφαρμογές και αποκλεισμός στιγμιότυπων οθόνης',
  'mobile.security.privacyScreenHint': 'Η εφαρμογή εμφανίζεται ως κενή κάρτα στην οθόνη πρόσφατων εφαρμογών και τα στιγμιότυπα οθόνης της αποκλείονται.',
  'mobile.security.biometric': 'Ξεκλείδωμα με δακτυλικό αποτύπωμα ή πρόσωπο',
  'mobile.security.biometricHint': 'Μόνο για την οθόνη κλειδώματος. Η σύνδεση και η επιβεβαίωση ευαίσθητων αλλαγών ζητούν πάντα τον κωδικό.',
  'mobile.security.biometricUnavailable': 'Σε αυτό το τηλέφωνο δεν έχει ρυθμιστεί ξεκλείδωμα με δακτυλικό αποτύπωμα ή πρόσωπο.',
  'mobile.security.saved': 'Η ρύθμιση αποθηκεύτηκε.',
  'mobile.lock.biometric': 'Ξεκλείδωμα με δακτυλικό αποτύπωμα ή πρόσωπο',
  'mobile.lock.biometricTitle': 'Ξεκλείδωμα του Your Personal Diary',
  'mobile.lock.usePassword': 'Χρήση κωδικού',
  'mobile.lock.biometricFailed': 'Το βιομετρικό ξεκλείδωμα δεν λειτούργησε. Πληκτρολογήστε τον κωδικό σας.',
};
export default messages;
