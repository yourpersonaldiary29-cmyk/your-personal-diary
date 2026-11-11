/** el - settings messages. Keys are prefixed 'settings.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Language card (src/pages/settings/LanguageSection.tsx, src/context/LanguageContext.tsx)
  'settings.language.title': 'Γλώσσα',
  'settings.language.label': 'Γλώσσα περιβάλλοντος',
  'settings.language.hint':
    'Όλο το ημερολόγιο αλλάζει αμέσως στην επιλεγμένη γλώσσα. Πριν από τη σύνδεση η επιλογή κρατιέται σε αυτή τη συσκευή· μετά τη σύνδεση αποθηκεύεται στον λογαριασμό σου.',
  'settings.language.changed': 'Η γλώσσα άλλαξε: {language}',
  'settings.language.saveFailed': 'Η γλώσσα άλλαξε σε αυτή τη συσκευή, αλλά η αποθήκευσή της στον λογαριασμό απέτυχε.',

  // Page titles (src/pages/SettingsPage.tsx, BackupPage.tsx)
  'settings.title': 'Ρυθμίσεις',
  'settings.backup.pageTitle': 'Αντίγραφο ασφαλείας, επαναφορά και εξαγωγή',
  'settings.actionCancelled': 'Η ενέργεια ακυρώθηκε.',

  // Account card (src/pages/settings/AccountSection.tsx, ProfileEditor.tsx, ChangePasswordDialog.tsx)
  'settings.account.title': 'Λογαριασμός',
  'settings.account.anonymousText':
    'Οι ρυθμίσεις λογαριασμού, ασφάλειας, υπενθυμίσεων και δεδομένων είναι διαθέσιμες μετά τη σύνδεση. Οι προτιμήσεις εμφάνισης κρατιούνται σε αυτή τη συσκευή ακόμη και χωρίς λογαριασμό.',
  'settings.account.setEmail': 'Ορισμός',
  'settings.account.setEmailTitle': 'Ορισμός διεύθυνσης e-mail',
  'settings.account.emailSaved': 'Η διεύθυνση e-mail αποθηκεύτηκε.',
  'settings.account.editDetails': 'Επεξεργασία στοιχείων',
  'settings.account.editDetailsHint': 'Το όνομα χρησιμοποιείται και στον χαιρετισμό στο πάνω μέρος του ημερολογίου.',
  'settings.account.emailPassword': 'Ο κωδικός του λογαριασμού σου',
  'settings.account.emailPasswordHint': 'Χρειάζεται για να αλλάξεις τη διεύθυνση e-mail, γιατί σε αυτήν στέλνονται τα e-mail επαναφοράς κωδικού.',
  'settings.account.profileSaved': 'Τα στοιχεία σου αποθηκεύτηκαν.',
  'settings.account.noChanges': 'Δεν άλλαξε τίποτα.',
  'settings.account.changePassword': 'Αλλαγή κωδικού πρόσβασης',
  'settings.account.logout': 'Αποσύνδεση',
  'settings.account.logoutQuestion':
    'Αποσύνδεση από το ημερολόγιο; Για να επιστρέψεις θα χρειαστεί να πληκτρολογήσεις το όνομα χρήστη και τον κωδικό πρόσβασης.',
  'settings.account.oldPassword': 'Παλιός κωδικός πρόσβασης',
  'settings.account.newPassword': 'Νέος κωδικός πρόσβασης',
  'settings.account.confirmNewPassword': 'Επιβεβαίωση νέου κωδικού πρόσβασης',
  'settings.account.newPasswordHint': 'Τουλάχιστον {min} χαρακτήρες, με γράμματα και ψηφία',
  'settings.account.passwordChanged': 'Ο κωδικός πρόσβασης άλλαξε',
  'settings.account.wrongOldPassword': 'Ο παλιός κωδικός πρόσβασης είναι λανθασμένος. Δοκίμασε ξανά.',
  'settings.account.passwordChangeHint': 'Η αλλαγή του κωδικού κρυπτογραφεί ξανά το ημερολόγιο και αποσυνδέει όλες τις άλλες συσκευές.',
  // Account ID row (hosted server only): the server owner copies it to turn the owner cards on.
  'settings.account.accountId': 'Αναγνωριστικό λογαριασμού',
  'settings.account.copyAccountId': 'Αντιγραφή αναγνωριστικού λογαριασμού',
  'settings.account.accountIdCopied': 'Το αναγνωριστικό λογαριασμού αντιγράφηκε',
  'settings.account.accountIdCopyFailed': 'Η αντιγραφή απέτυχε. Επίλεξε το αναγνωριστικό λογαριασμού και αντίγραψέ το χειροκίνητα.',
  'settings.account.accountIdHint': 'Το χρειάζεται μόνο ο κάτοχος του διακομιστή, για να ενεργοποιήσει τις κάρτες κατόχου.',

  // Connected devices (src/pages/settings/SessionsList.tsx)
  'settings.devices.title': 'Συνδεδεμένες συσκευές',
  'settings.devices.hint':
    'Όλες οι συσκευές που είναι αυτή τη στιγμή συνδεδεμένες σε αυτόν τον λογαριασμό. Η αποσύνδεση μιας συσκευής τερματίζει αμέσως τη συνεδρία της.',
  'settings.devices.current': 'Αυτή η συσκευή',
  'settings.devices.remembered': 'Να με θυμάσαι',
  'settings.devices.unknown': 'Συσκευή χωρίς όνομα',
  'settings.devices.connectedAt': 'Σύνδεση',
  'settings.devices.lastSeen': 'Τελευταία δραστηριότητα',
  'settings.devices.revoke': 'Αποσύνδεση',
  'settings.devices.revokeName': 'Αποσύνδεση: {device}',
  'settings.devices.none': 'Δεν υπάρχουν συνδεδεμένες συσκευές.',
  'settings.devices.revoked': 'Η συσκευή «{device}» αποσυνδέθηκε.',

  // Display card (src/pages/settings/DisplaySection.tsx)
  'settings.display.title': 'Εμφάνιση',
  'settings.display.theme': 'Θέμα',
  'settings.display.themeOption.system': 'Όπως το σύστημα',
  'settings.display.themeOption.light': 'Φωτεινό',
  'settings.display.themeOption.dark': 'Σκοτεινό',
  'settings.display.themeOption.highContrast': 'Υψηλή αντίθεση',
  'settings.display.themeChanged': 'Το θέμα άλλαξε: {label}',
  'settings.display.fontScale': 'Μέγεθος κειμένου',
  'settings.display.fontScaleOption.small': 'Μικρό ({percent}%)',
  'settings.display.fontScaleOption.normal': 'Κανονικό ({percent}%)',
  'settings.display.fontScaleOption.large': 'Μεγάλο ({percent}%)',
  'settings.display.fontScaleOption.veryLarge': 'Πολύ μεγάλο ({percent}%)',
  'settings.display.fontScaleOption.huge': 'Τεράστιο ({percent}%)',
  'settings.display.fontScaleOption.custom': 'Προσαρμοσμένο ({percent}%)',
  'settings.display.fontScaleChanged': 'Το μέγεθος κειμένου άλλαξε: {label}',
  'settings.display.reduceMotion': 'Μείωση κίνησης',
  'settings.display.reduceMotionHint': 'Απενεργοποιεί τις κινούμενες εικόνες και τις μεταβάσεις στο περιβάλλον.',
  'settings.display.reduceMotionOn': 'Η μείωση κίνησης ενεργοποιήθηκε.',
  'settings.display.reduceMotionOff': 'Η μείωση κίνησης απενεργοποιήθηκε.',
  'settings.display.firstDayOfWeek': 'Πρώτη ημέρα της εβδομάδας',
  'settings.display.sunday': 'Κυριακή',
  'settings.display.monday': 'Δευτέρα',
  'settings.display.firstDayChanged': 'Πρώτη ημέρα της εβδομάδας: {label}.',
  'settings.display.anonymousHint':
    'Οι προτιμήσεις κρατιούνται σε αυτό το πρόγραμμα περιήγησης. Μετά τη σύνδεση αποθηκεύονται στον λογαριασμό σου.',

  // Security card (src/pages/settings/SecuritySection.tsx)
  'settings.security.title': 'Ασφάλεια',
  'settings.security.autoLock': 'Αυτόματο κλείδωμα μετά από αδράνεια',
  'settings.security.autoLockHint':
    'Μετά τον χρόνο που επιλέγεις, το ημερολόγιο εμφανίζει οθόνη κλειδώματος και ζητά τον κωδικό πρόσβασης. Η σύνδεσή σου παραμένει ενεργή.',
  'settings.security.autoLockOff': 'Ανενεργό',
  'settings.security.autoLockChanged': 'Αυτόματο κλείδωμα: {label}',
  'settings.security.lockNow': 'Κλείδωμα τώρα',
  'settings.security.lockNowHint': 'Μπορείς επίσης να κλειδώσεις οποιαδήποτε στιγμή με Ctrl+L.',

  // Reminders card (src/pages/settings/RemindersSection.tsx)
  'settings.reminders.title': 'Υπενθυμίσεις',
  'settings.reminders.enabled': 'Εμφάνιση υπενθυμίσεων συνηθειών',
  'settings.reminders.hint':
    'Οι υπενθυμίσεις είναι μόνο τοπικές ειδοποιήσεις – στον υπολογιστή ή στο πρόγραμμα περιήγησης όπου είναι ανοιχτό το ημερολόγιο. Δεν στέλνεται τίποτα προς τα έξω.',
  'settings.reminders.explanation':
    'Η ώρα της υπενθύμισης ορίζεται χωριστά για κάθε συνήθεια στη σελίδα των συνηθειών. Όσο αυτή η επιλογή είναι ανενεργή, δεν εμφανίζεται καμία υπενθύμιση.',
  'settings.reminders.on': 'Οι υπενθυμίσεις ενεργοποιήθηκαν.',
  'settings.reminders.off': 'Οι υπενθυμίσεις απενεργοποιήθηκαν.',
  'settings.reminders.habitsLink': 'Μετάβαση στη σελίδα των συνηθειών',

  // Privacy card (src/pages/settings/PrivacySection.tsx)
  // Link to the privacy policy page of the diary server (src/components/legal/PrivacyPolicyLink.tsx)
  'settings.privacy.policyLink': 'Πολιτική απορρήτου',
  'settings.privacy.termsLink': 'Όροι χρήσης',
  'settings.privacy.title': 'Απόρρητο',
  'settings.privacy.offlineLabel': 'Λειτουργία απορρήτου εκτός σύνδεσης',
  'settings.privacy.offlineHint':
    'Όταν είναι ενεργή, η ίδια η εφαρμογή δεν μπορεί να ανοίξει καμία σύνδεση δικτύου εκτός από τον δικό της τοπικό διακομιστή. Απενεργοποίησέ την μόνο αν χρησιμοποιείς απομακρυσμένη πρόσβαση.',
  'settings.privacy.offlineOn': 'Η λειτουργία απορρήτου εκτός σύνδεσης ενεργοποιήθηκε.',
  'settings.privacy.offlineOff': 'Η λειτουργία απορρήτου εκτός σύνδεσης απενεργοποιήθηκε.',
  // Data card (src/pages/settings/DataSection.tsx)
  'settings.data.title': 'Δεδομένα',
  'settings.data.reassurance':
    'Τα δεδομένα του ημερολογίου σου αποθηκεύονται στον προσωπικό σου λογαριασμό και είναι κρυπτογραφημένα από άκρο σε άκρο.',
  'settings.data.seedDemo': 'Φόρτωση δειγματικών δεδομένων',
  'settings.data.seedDemoTitle': 'Φόρτωση δειγματικών δεδομένων',
  'settings.data.seedDemoMessage':
    'Το ημερολόγιο είναι προς το παρόν άδειο. Θα δημιουργηθούν φανταστικές καταχωρίσεις και συνήθειες για περίπου {days} ημέρες, ώστε να πάρεις μια ιδέα για τις παρατηρήσεις, τα στατιστικά και την αναζήτηση. Μπορείς να τις επεξεργαστείς και να τις διαγράψεις όπως κάθε άλλη καταχώριση.',
  'settings.data.seedDemoConfirm': 'Φόρτωση',
  'settings.data.seedDemoDone':
    'Φορτώθηκαν {entries, plural, one {# καταχώριση} other {# καταχωρίσεις}}, {habits, plural, one {# συνήθεια} other {# συνήθειες}} και {logs, plural, one {# καταγραφή συνήθειας} other {# καταγραφές συνηθειών}}.',

  // Delete account card - the last card of the page (src/pages/settings/DeleteAccountSection.tsx)
  'settings.deleteAccount.title': 'Διαγραφή λογαριασμού',
  'settings.deleteAccount.warning':
    'Η διαγραφή του λογαριασμού σου τον σβήνει οριστικά μαζί με το ημερολόγιο, τις συνήθειες και τις ρυθμίσεις του και τον αποσυνδέει από όλες τις συσκευές. Δεν μπορεί να επαναφερθεί. Τα αρχεία αντιγράφων ασφαλείας που έχεις αποθηκεύσει αλλού δεν επηρεάζονται.',
  'settings.deleteAccount.button': 'Διαγραφή λογαριασμού',
  'settings.deleteAccount.dialogTitle': 'Να διαγραφεί ο λογαριασμός «{username}»;',
  'settings.deleteAccount.passwordHint': 'Για επιβεβαίωση, πληκτρολόγησε τον κωδικό πρόσβασης του λογαριασμού.',
  'settings.deleteAccount.understand': 'Καταλαβαίνω ότι αυτό δεν μπορεί να αναιρεθεί',
  'settings.deleteAccount.confirm': 'Οριστική διαγραφή λογαριασμού',
  'settings.deleteAccount.done': 'Όλα τα δεδομένα και ο λογαριασμός διαγράφηκαν.',
  'settings.deleteAccount.wrongPassword': 'Ο κωδικός πρόσβασης είναι λανθασμένος. Δοκίμασε ξανά.',
  'settings.deleteAccount.ownerRemote':
    'Ο λογαριασμός σου είναι ο κάτοχος της απομακρυσμένης πρόσβασης σε αυτόν τον υπολογιστή. Με τη διαγραφή του η απομακρυσμένη πρόσβαση απενεργοποιείται και οι ρυθμίσεις της (διεύθυνση και token DuckDNS, πιστοποιητικό) σβήνονται· κάτοχος γίνεται ο παλαιότερος από τους λογαριασμούς που απομένουν και μπορεί να τη ρυθμίσει ξανά.',
  'settings.deleteAccount.ownerMail':
    'Ο λογαριασμός σου είναι ο κάτοχος του e-mail για επαναφορά κωδικού σε αυτόν τον υπολογιστή. Με τη διαγραφή του η αποστολή e-mail απενεργοποιείται και οι ρυθμίσεις του (λογαριασμός αποστολής και κωδικός εφαρμογής) σβήνονται· κάτοχος γίνεται ο παλαιότερος από τους λογαριασμούς που απομένουν και μπορεί να το ρυθμίσει ξανά.',
  'settings.deleteAccount.ownerBoth':
    'Ο λογαριασμός σου είναι ο κάτοχος της απομακρυσμένης πρόσβασης και του e-mail για επαναφορά κωδικού σε αυτόν τον υπολογιστή. Με τη διαγραφή του απενεργοποιούνται και τα δύο και οι ρυθμίσεις τους (διεύθυνση και token DuckDNS, πιστοποιητικό, λογαριασμός αποστολής και κωδικός εφαρμογής) σβήνονται· κάτοχός τους γίνεται ο παλαιότερος από τους λογαριασμούς που απομένουν και μπορεί να τα ρυθμίσει ξανά.',
  // The owner line on the Your Personal Diary server (hosted mode): its owner is DIARY_OWNER_ID only, and deleting
  // the owner erases the mail settings and promotes nobody (server/src/hosted/owner.ts, docs/API.md "בעלות").
  'settings.deleteAccount.ownerHosted':
    'Ο λογαριασμός σου είναι ο κάτοχος του διακομιστή του ημερολογίου. Με τη διαγραφή του σταματούν τα e-mail επαναφοράς κωδικού για όλους τους λογαριασμούς και σβήνονται οι ρυθμίσεις του e-mail (λογαριασμός αποστολής και κωδικός εφαρμογής). Κανένας άλλος λογαριασμός δεν γίνεται κάτοχος, οπότε κανείς δεν θα μπορεί να ανοίξει την κάρτα «Διακομιστής» ή να ετοιμάσει αρχειοθέτηση διακομιστή. Αν εγγραφείς ξανά, ο νέος λογαριασμός θα έχει νέο αναγνωριστικό λογαριασμού, που πρέπει να οριστεί ξανά ως DIARY_OWNER_ID στον διακομιστή.',

  // Diagnostics card (src/pages/settings/DiagnosticsSection.tsx, desktop only)
  'settings.diagnostics.title': 'Διαγνωστικά',
  'settings.diagnostics.hint':
    'Τεχνικές πληροφορίες για τον τοπικό διακομιστή που τρέχει στο παρασκήνιο. Χρήσιμες αν κάτι δεν λειτουργεί.',
  'settings.diagnostics.uiVersion': 'Έκδοση περιβάλλοντος',
  'settings.diagnostics.serverVersion': 'Έκδοση διακομιστή',
  'settings.diagnostics.port': 'Θύρα',
  'settings.diagnostics.lanStatus': 'Πρόσβαση δικτύου',
  'settings.diagnostics.lanOn': 'Ενεργή',
  'settings.diagnostics.lanOff': 'Ανενεργή',
  'settings.diagnostics.startedAt': 'Εκκίνηση',
  'settings.diagnostics.showServerLog': 'Εμφάνιση αρχείου καταγραφής διακομιστή',
  'settings.diagnostics.hideServerLog': 'Απόκρυψη αρχείου καταγραφής διακομιστή',
  'settings.diagnostics.serverLog': 'Αρχείο καταγραφής διακομιστή',
  'settings.diagnostics.serverLogEmpty': 'Το αρχείο καταγραφής του διακομιστή είναι κενό.',
  'settings.diagnostics.serverLogLoaded':
    'Φορτώθηκε το αρχείο καταγραφής του διακομιστή: {count, plural, one {# γραμμή} other {# γραμμές}}.',
  'settings.diagnostics.serverLogFailed': 'Δεν ήταν δυνατή η ανάγνωση του αρχείου καταγραφής του διακομιστή.',
  'settings.diagnostics.restartServer': 'Επανεκκίνηση διακομιστή',
  'settings.diagnostics.restartTitle': 'Επανεκκίνηση του διακομιστή',
  'settings.diagnostics.restartMessage':
    'Ο τοπικός διακομιστής θα κλείσει και θα ξεκινήσει ξανά, και το περιβάλλον θα φορτωθεί ξανά για να συνδεθεί εκ νέου μαζί του. Αν δεν είχε επιλεγεί το «Να με θυμάσαι», ίσως χρειαστεί να συνδεθείς ξανά.',
  'settings.diagnostics.restartConfirm': 'Επανεκκίνηση',
  'settings.diagnostics.restarting': 'Ο διακομιστής κάνει επανεκκίνηση. Το περιβάλλον θα φορτωθεί ξανά σε λίγο.',
  'settings.diagnostics.restartFailed': 'Η επανεκκίνηση του διακομιστή απέτυχε.',

  // Data card: phone (LAN) access, desktop only (src/pages/settings/LanAccessSection.tsx)
  'settings.lan.title': 'Πρόσβαση από το κινητό στο οικιακό δίκτυο',
  'settings.lan.label': 'Πρόσβαση από το κινητό στο οικιακό δίκτυο',
  'settings.lan.hint':
    'Ο τοπικός διακομιστής θα ακούει και στο οικιακό δίκτυο Wi-Fi, ώστε το ίδιο ημερολόγιο να ανοίγει και από το κινητό. Τα δεδομένα δεν φεύγουν ποτέ από το σπίτι.',
  'settings.lan.onlyFromComputer':
    'Η πρόσβαση από το κινητό ενεργοποιείται ή απενεργοποιείται μόνο από τον υπολογιστή όπου είναι εγκατεστημένο το ημερολόγιο.',
  'settings.lan.enabled': 'Η πρόσβαση από το κινητό ενεργοποιήθηκε.',
  'settings.lan.disabled': 'Η πρόσβαση από το κινητό απενεργοποιήθηκε.',
  'settings.lan.ownerOnly': 'Μόνο ο λογαριασμός που κατέχει αυτόν τον υπολογιστή (ο πρώτος που δημιουργήθηκε σε αυτόν) μπορεί να ενεργοποιήσει ή να απενεργοποιήσει την πρόσβαση από το κινητό.',
  'settings.lan.statusOn': 'Η πρόσβαση από το κινητό είναι ενεργή.',
  'settings.lan.statusOff': 'Η πρόσβαση από το κινητό είναι ανενεργή.',
  'settings.lan.confirmTitle': 'Ενεργοποίηση πρόσβασης από το κινητό',
  'settings.lan.confirmMessage': 'Τα κινητά και οι υπολογιστές στο οικιακό δίκτυο θα μπορούν να ανοίξουν τη σελίδα σύνδεσης του ημερολογίου. Για επιβεβαίωση, γράψε τον κωδικό του λογαριασμού σου.',
  'settings.lan.urlsTitle': 'Διευθύνσεις για άνοιγμα στο κινητό',
  'settings.lan.noUrls':
    'Δεν βρέθηκε διεύθυνση δικτύου. Βεβαιώσου ότι ο υπολογιστής είναι συνδεδεμένος σε Wi-Fi και δοκίμασε ξανά.',
  'settings.lan.copy': 'Αντιγραφή',
  'settings.lan.copyName': 'Αντιγραφή {url}',
  'settings.lan.copied': 'Η διεύθυνση {url} αντιγράφηκε.',
  'settings.lan.copyFailed': 'Η αντιγραφή απέτυχε. Μπορείς να επιλέξεις τη διεύθυνση και να την αντιγράψεις χειροκίνητα.',
  'settings.lan.instructionsTitle': 'Πώς να συνδεθείς από το κινητό',
  'settings.lan.instructions.sameNetwork': 'Βεβαιώσου ότι το κινητό είναι συνδεδεμένο στο ίδιο δίκτυο Wi-Fi με τον υπολογιστή.',
  'settings.lan.instructions.openUrl':
    'Άνοιξε μία από τις παραπάνω διευθύνσεις στο πρόγραμμα περιήγησης του κινητού και συνδέσου με το ίδιο όνομα χρήστη και κωδικό πρόσβασης.',
  'settings.lan.instructions.firewall':
    'Την πρώτη φορά, το Τείχος προστασίας των Windows μπορεί να ζητήσει άδεια – επίτρεψε την πρόσβαση μόνο σε ιδιωτικά δίκτυα.',
  'settings.lan.instructions.sameServer':
    'Το κινητό βλέπει ακριβώς ό,τι γίνεται στον υπολογιστή, επειδή και τα δύο λειτουργούν με τον ίδιο τοπικό διακομιστή.',

  // Backup page: backup card (src/pages/settings/BackupCreateSection.tsx)
  'settings.backup.title': 'Αντίγραφο ασφαλείας',
  'settings.backup.explanation':
    'Το αρχείο αντιγράφου ασφαλείας είναι ένα κρυπτογραφημένο αντίγραφο ολόκληρου του ημερολογίου (καταχωρίσεις, συνήθειες και ρυθμίσεις) σε μορφή .mpd. Φύλαξέ το σε ασφαλές μέρος – για παράδειγμα σε εξωτερικό δίσκο. Χωρίς τον κωδικό πρόσβασης δεν μπορεί να ανοίξει.',
  'settings.backup.ownPassword': 'Διαφορετικός κωδικός για το αντίγραφο ασφαλείας',
  'settings.backup.ownPasswordHint':
    'Από προεπιλογή το αντίγραφο ασφαλείας κρυπτογραφείται με τον κωδικό του λογαριασμού. Μπορείς να επιλέξεις διαφορετικό κωδικό μόνο για αυτό το αρχείο.',
  'settings.backup.password': 'Κωδικός αντιγράφου ασφαλείας',
  'settings.backup.passwordConfirm': 'Επιβεβαίωση κωδικού αντιγράφου ασφαλείας',
  'settings.backup.create': 'Δημιουργία αρχείου αντιγράφου ασφαλείας',
  'settings.backup.fileFilter': 'Κρυπτογραφημένο αρχείο αντιγράφου ασφαλείας',
  'settings.backup.created': 'Το αντίγραφο ασφαλείας δημιουργήθηκε: {fileName} ({size}).',

  // Backup page: restore card (src/pages/settings/RestoreSection.tsx)
  'settings.restore.title': 'Επαναφορά από αντίγραφο ασφαλείας',
  'settings.restore.explanation':
    'Η επαναφορά αντικαθιστά το τρέχον ημερολόγιο με το περιεχόμενο του αρχείου αντιγράφου ασφαλείας. Ο κωδικός του λογαριασμού δεν αλλάζει.',
  'settings.restore.pickFile': 'Επιλογή αρχείου αντιγράφου ασφαλείας',
  'settings.restore.fileField': 'Αρχείο αντιγράφου ασφαλείας',
  'settings.restore.fileHint': 'Ένα αρχείο .mpd που δημιουργήθηκε σε αυτή τη σελίδα.',
  'settings.restore.chosenFile': 'Αρχείο',
  'settings.restore.fileSize': 'Μέγεθος',
  'settings.restore.fileStatus': 'Κατάσταση',
  'settings.restore.inspecting': 'Έλεγχος του αρχείου…',
  'settings.restore.action': 'Επαναφορά από το αντίγραφο ασφαλείας',
  'settings.restore.confirmTitle': 'Επαναφορά από το αντίγραφο ασφαλείας;',
  'settings.restore.warning':
    'Το τρέχον ημερολόγιο – όλες οι καταχωρίσεις, οι συνήθειες και οι ρυθμίσεις – θα αντικατασταθεί με το περιεχόμενο του αρχείου αντιγράφου ασφαλείας. Αυτό δεν μπορεί να αναιρεθεί. Συνιστάται να δημιουργήσεις πρώτα αντίγραφο ασφαλείας του τρέχοντος ημερολογίου.',
  'settings.restore.confirm': 'Επαναφορά',
  'settings.restore.done':
    'Η επαναφορά ολοκληρώθηκε: {entries, plural, one {# καταχώριση} other {# καταχωρίσεις}} και {habits, plural, one {# συνήθεια} other {# συνήθειες}}.',
  'settings.restore.needFile': 'Επίλεξε ένα αρχείο αντιγράφου ασφαλείας',
  'settings.restore.invalidFile': 'Το επιλεγμένο αρχείο δεν είναι έγκυρο αρχείο αντιγράφου ασφαλείας',

  // Backup page: export card (src/pages/settings/ExportSection.tsx)
  'settings.export.title': 'Εξαγωγή',
  'settings.export.explanation':
    'Η εξαγωγή δημιουργεί ένα αναγνώσιμο (μη κρυπτογραφημένο) αρχείο με τις καταχωρίσεις, για παράδειγμα για ανάγνωση, εκτύπωση ή χρήση σε άλλο πρόγραμμα. Φύλαξέ το με ανάλογη προσοχή.',
  'settings.export.format': 'Μορφή',
  'settings.export.formatOption.txt': 'TXT – κείμενο',
  'settings.export.formatOption.csv': 'CSV – πίνακας',
  'settings.export.formatOption.json': 'JSON – πλήρη δεδομένα',
  'settings.export.formatOption.pdf': 'PDF – έγγραφο',
  'settings.export.formatHint.txt': 'Απλό αρχείο κειμένου που ανοίγει σε κάθε υπολογιστή και κινητό',
  'settings.export.formatHint.csv': 'Για άνοιγμα στο Excel ή σε άλλο υπολογιστικό φύλλο',
  'settings.export.formatHint.json': 'Όλα τα πεδία, κατάλληλο για μεταφορά σε άλλο πρόγραμμα',
  'settings.export.formatHint.pdf': 'Μορφοποιημένο έγγραφο για ανάγνωση και εκτύπωση',
  'settings.export.filter.txt': 'Αρχείο κειμένου',
  'settings.export.filter.csv': 'Αρχείο CSV',
  'settings.export.filter.json': 'Αρχείο JSON',
  'settings.export.filter.pdf': 'Έγγραφο PDF',
  'settings.export.from': 'Από ημερομηνία',
  'settings.export.to': 'Έως ημερομηνία',
  'settings.export.rangeHint': 'Άφησέ τα κενά για να εξαγάγεις ολόκληρο το ημερολόγιο.',
  'settings.export.rangeError': 'Η ημερομηνία λήξης πρέπει να είναι ίδια με την ημερομηνία έναρξης ή μεταγενέστερη',
  'settings.export.includeHabits': 'Συμπερίληψη συνηθειών και καταγραφών',
  'settings.export.includeHabitsCsv': 'Ένα αρχείο CSV περιέχει μόνο τις καταχωρίσεις. Οι συνήθειες περιλαμβάνονται στις μορφές TXT, JSON και PDF.',
  'settings.export.action': 'Εξαγωγή',
  'settings.export.done': 'Η εξαγωγή ολοκληρώθηκε: {count, plural, one {# καταχώριση} other {# καταχωρίσεις}}.',
  'settings.export.doneWithFile': 'Η εξαγωγή ολοκληρώθηκε: {count, plural, one {# καταχώριση} other {# καταχωρίσεις}}. {fileName}',
  'settings.export.downloaded': 'Η εξαγωγή ολοκληρώθηκε. Έγινε λήψη του αρχείου {fileName}.',

  // Remote access card (src/pages/settings/RemoteAccessSection.tsx; the Privacy card's confirmation in PrivacySection.tsx)
  'settings.remote.title': 'Απομακρυσμένη πρόσβαση',
  'settings.remote.intro':
    'Άνοιξε το ημερολόγιό σου από οπουδήποτε – από το κινητό ή από άλλον υπολογιστή – στη δική σου διεύθυνση DuckDNS. Το ημερολόγιο μένει σε αυτόν τον υπολογιστή και τίποτα δεν ανεβαίνει σε cloud: αυτός ο υπολογιστής απαντά μέσω κρυπτογραφημένης σύνδεσης HTTPS.',
  'settings.remote.switchLabel': 'Να επιτρέπεται η πρόσβαση από το διαδίκτυο',
  'settings.remote.switchHint':
    'Ανενεργό από προεπιλογή. Όσο είναι ενεργό, αυτός ο υπολογιστής επικοινωνεί με το DuckDNS (για να δείχνει η διεύθυνσή σου εδώ) και με το Let’s Encrypt (για το πιστοποιητικό ασφαλείας), γι’ αυτό η λειτουργία απορρήτου εκτός σύνδεσης απενεργοποιείται.',
  'settings.remote.enabled':
    'Η απομακρυσμένη πρόσβαση ενεργοποιήθηκε. Η ρύθμιση μπορεί να διαρκέσει περίπου δύο λεπτά· η κατάσταση παρακάτω ενημερώνεται αυτόματα.',
  'settings.remote.disabled': 'Η απομακρυσμένη πρόσβαση απενεργοποιήθηκε. Το ημερολόγιο δεν ανοίγει πλέον από το διαδίκτυο.',
  'settings.remote.offlineTurnedOff':
    'Η λειτουργία απορρήτου εκτός σύνδεσης απενεργοποιήθηκε, επειδή η απομακρυσμένη πρόσβαση συνδέεται με το DuckDNS και το Let’s Encrypt.',
  'settings.remote.detailsTitle': 'Στοιχεία σύνδεσης',
  'settings.remote.hostname': 'Διεύθυνση DuckDNS',
  'settings.remote.hostnameHint': 'Το όνομα που δημιούργησες στο duckdns.org, για παράδειγμα yourpersonaldiary.duckdns.org.',
  'settings.remote.hostnameInvalid':
    'Πληκτρολόγησε ένα όνομα DuckDNS όπως yourpersonaldiary.duckdns.org (λατινικά γράμματα, ψηφία και παύλες).',
  'settings.remote.token': 'Token DuckDNS',
  'settings.remote.tokenHint':
    'Εμφανίζεται στο πάνω μέρος της σελίδας σου στο duckdns.org μετά τη σύνδεση. Αποθηκεύεται κρυπτογραφημένο σε αυτόν τον υπολογιστή και δεν εμφανίζεται ποτέ ξανά.',
  'settings.remote.tokenSaved':
    'Υπάρχει αποθηκευμένο token. Άφησε το πεδίο κενό για να το κρατήσεις ή πληκτρολόγησε νέο token για να το αντικαταστήσεις.',
  'settings.remote.tokenMissing': 'Πληκτρολόγησε το token σου από το DuckDNS.',
  'settings.remote.tokenInvalid':
    'Ένα token DuckDNS μοιάζει με xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (ψηφία και τα γράμματα a έως f).',
  'settings.remote.showToken': 'Εμφάνιση token',
  'settings.remote.publicPort': 'Θύρα στον δρομολογητή',
  'settings.remote.publicPortHint':
    'Η θύρα από την οποία το διαδίκτυο φτάνει σε αυτόν τον υπολογιστή. Η 443 είναι η τυπική θύρα HTTPS· άλλαξέ τη μόνο αν ο πάροχος διαδικτύου σου την μπλοκάρει.',
  'settings.remote.portInvalid': 'Πληκτρολόγησε έναν ακέραιο αριθμό από 1 έως 65535.',
  'settings.remote.upnp': 'Αυτόματο άνοιγμα της θύρας του δρομολογητή (UPnP)',
  'settings.remote.upnpHint':
    'Λειτουργεί με τους περισσότερους οικιακούς δρομολογητές. Αν δεν λειτουργήσει, οι οδηγίες παρακάτω εξηγούν πώς να ανοίξεις τη θύρα χειροκίνητα.',
  'settings.remote.save': 'Αποθήκευση στοιχείων',
  'settings.remote.saved': 'Τα στοιχεία απομακρυσμένης πρόσβασης αποθηκεύτηκαν.',
  'settings.remote.test': 'Έλεγχος σύνδεσης',
  'settings.remote.testTitle': 'Αποτελέσματα ελέγχου σύνδεσης',
  'settings.remote.testDone': 'Ο έλεγχος σύνδεσης ολοκληρώθηκε: επιτυχείς έλεγχοι {passed} από {total}.',
  'settings.remote.statusTitle': 'Κατάσταση',
  'settings.remote.busy':
    'Γίνεται ρύθμιση της απομακρυσμένης πρόσβασης. Μπορεί να διαρκέσει περίπου δύο λεπτά· η λίστα ενημερώνεται αυτόματα.',
  'settings.remote.ready': 'Η απομακρυσμένη πρόσβαση είναι έτοιμη. Η διεύθυνση του ημερολογίου σου: {url}',
  'settings.remote.failed': 'Δεν ήταν δυνατή η ρύθμιση της απομακρυσμένης πρόσβασης: {message}',
  'settings.remote.lastError': 'Τελευταίο πρόβλημα: {message}',
  'settings.remote.nextRetry': 'Επόμενη αυτόματη προσπάθεια: {time}.',
  'settings.remote.stepAt': 'Ενημερώθηκε: {time}',
  'settings.remote.state.idle': 'Δεν ξεκίνησε',
  'settings.remote.state.running': 'Σε εξέλιξη',
  'settings.remote.state.ok': 'Ολοκληρώθηκε',
  'settings.remote.state.error': 'Απέτυχε',
  'settings.remote.state.warning': 'Προειδοποίηση',
  'settings.remote.state.skipped': 'Παραλείφθηκε',
  'settings.remote.step.duckdns': 'Διεύθυνση DuckDNS',
  'settings.remote.step.certificate': 'Πιστοποιητικό ασφαλείας (Let’s Encrypt)',
  'settings.remote.step.listener': 'Ασφαλής σύνδεση (HTTPS)',
  'settings.remote.step.upnp': 'Θύρα δρομολογητή',
  'settings.remote.check.duckdns': 'Ενημέρωση DuckDNS',
  'settings.remote.check.upnp': 'Δρομολογητής (UPnP)',
  'settings.remote.check.dns': 'Αναζήτηση διεύθυνσης (DNS)',
  'settings.remote.check.https': 'Σύνδεση HTTPS',
  'settings.remote.publicIp': 'Δημόσια διεύθυνση IP',
  'settings.remote.unknown': 'Άγνωστη',
  'settings.remote.certificate': 'Πιστοποιητικό',
  'settings.remote.certificateValid':
    'Ισχύει έως {date} ({days, plural, one {απομένει # ημέρα} other {απομένουν # ημέρες}}), εκδότης: {issuer}. Ανανεώνεται αυτόματα.',
  'settings.remote.certificateStaging':
    'Αυτό είναι δοκιμαστικό πιστοποιητικό (Let’s Encrypt staging)· τα προγράμματα περιήγησης θα εμφανίζουν προειδοποίηση.',
  'settings.remote.noCertificate': 'Δεν υπάρχει ακόμη πιστοποιητικό.',
  'settings.remote.renew': 'Ανανέωση πιστοποιητικού',
  'settings.remote.renewStarted': 'Η ανανέωση του πιστοποιητικού ξεκίνησε. Μπορεί να διαρκέσει περίπου δύο λεπτά.',
  'settings.remote.urlTitle': 'Η διεύθυνση του ημερολογίου σου',
  'settings.remote.urlHint':
    'Άνοιξε αυτή τη διεύθυνση στο κινητό ή σε οποιονδήποτε υπολογιστή και συνδέσου με το όνομα χρήστη και τον κωδικό σου.',
  'settings.remote.noUrl': 'Η διεύθυνση θα εμφανιστεί εδώ μόλις η ασφαλής σύνδεση είναι έτοιμη.',
  'settings.remote.qrLabel': 'Κωδικός QR της διεύθυνσης {url}',
  'settings.remote.qrHint': 'Σάρωσε τον κωδικό με την κάμερα του κινητού για να ανοίξεις τη διεύθυνση.',
  'settings.remote.instructionsTitle': 'Πώς λειτουργεί και τι χρειάζεσαι',
  'settings.remote.instructions.account':
    'Δημιούργησε δωρεάν λογαριασμό στο duckdns.org, πρόσθεσε ένα όνομα (για παράδειγμα yourpersonaldiary) και αντίγραψε το token που εμφανίζεται στη σελίδα.',
  'settings.remote.instructions.enter':
    'Πληκτρολόγησε παραπάνω το όνομα και το token, τσέκαρε το «Να επιτρέπεται η πρόσβαση από το διαδίκτυο», γράψε τον κωδικό του λογαριασμού σου και επίλεξε «Αποθήκευση στοιχείων».',
  'settings.remote.instructions.firstCertificate':
    'Το πρώτο πιστοποιητικό μπορεί να χρειαστεί περίπου δύο λεπτά. Η λίστα κατάστασης ενημερώνεται αυτόματα.',
  'settings.remote.instructions.keepOn':
    'Κράτα αυτόν τον υπολογιστή ανοιχτό και την εφαρμογή του ημερολογίου σε λειτουργία: το ημερολόγιο είναι προσβάσιμο μόνο όσο λειτουργούν και τα δύο.',
  'settings.remote.instructions.manualForward':
    'Αν η θύρα του δρομολογητή δεν μπορεί να ανοίξει αυτόματα, άνοιξε τις ρυθμίσεις του δρομολογητή και προώθησε την εξωτερική θύρα {publicPort} (TCP) στη διεύθυνση αυτού του υπολογιστή {ip}, θύρα {port}.',
  'settings.remote.instructions.manualForwardNoIp':
    'Αν η θύρα του δρομολογητή δεν μπορεί να ανοίξει αυτόματα, άνοιξε τις ρυθμίσεις του δρομολογητή και προώθησε την εξωτερική θύρα {publicPort} (TCP) σε αυτόν τον υπολογιστή (στη διεύθυνσή του στο οικιακό δίκτυο), θύρα {port}.',
  'settings.remote.instructions.signIn':
    'Στο κινητό, άνοιξε τη διεύθυνση και συνδέσου με το όνομα χρήστη και τον κωδικό σου – όλα όσα έγραψες είναι εκεί.',
  'settings.remote.instructions.firewall':
    'Αν το Τείχος προστασίας των Windows ρωτήσει αν θα επιτραπεί το diary-server.exe (μέρος του Your Personal Diary), επίτρεψέ το (ίσως χρειαστεί έγκριση διαχειριστή). Διαφορετικά, οι συνδέσεις από το διαδίκτυο μπλοκάρονται.',
  'settings.remote.instructions.atHome':
    'Στο σπίτι, στο ίδιο δίκτυο, η διαδικτυακή διεύθυνση μπορεί να μην ανοίγει (πολλοί δρομολογητές δεν το υποστηρίζουν). Εκεί χρησιμοποίησε την «Πρόσβαση από το κινητό στο οικιακό δίκτυο».',
  'settings.remote.privacyNote':
    'Απόρρητο: οι καταχωρίσεις σου μένουν σε αυτόν τον υπολογιστή και ταξιδεύουν, κρυπτογραφημένες, μόνο προς τις συσκευές από τις οποίες συνδέεσαι. Το DuckDNS μαθαίνει τη δημόσια διεύθυνση IP αυτού του υπολογιστή και το Let’s Encrypt μαθαίνει το όνομα της διεύθυνσής σου. Όποιος γνωρίζει τη διεύθυνση μπορεί να φτάσει στη σελίδα σύνδεσης, γι’ αυτό χρησιμοποίησε ισχυρό κωδικό· επανειλημμένοι λανθασμένοι κωδικοί κλειδώνουν τις συνδέσεις από άλλες συσκευές για 15 λεπτά (αυτός ο υπολογιστής μπορεί πάντα να συνδεθεί). Νέοι λογαριασμοί δεν μπορούν να δημιουργηθούν μέσω διαδικτύου.',
  'settings.remote.offlineConflictTitle': 'Ενεργοποίηση της λειτουργίας απορρήτου εκτός σύνδεσης;',
  'settings.remote.offlineConflictMessage':
    'Η λειτουργία απορρήτου εκτός σύνδεσης δεν επιτρέπει τις συνδέσεις που χρειάζεται η απομακρυσμένη πρόσβαση (DuckDNS και Let’s Encrypt). Η ενεργοποίησή της απενεργοποιεί και την απομακρυσμένη πρόσβαση, και το ημερολόγιο δεν θα ανοίγει πλέον από το διαδίκτυο.',
  'settings.remote.offlineConflictConfirm': 'Απενεργοποίηση απομακρυσμένης πρόσβασης',
  'settings.remote.disabledByOffline': 'Η απομακρυσμένη πρόσβαση απενεργοποιήθηκε.',
  'settings.remote.offlineConflictPassword':
    'Πληκτρολόγησε τον κωδικό του λογαριασμού σου για να απενεργοποιήσεις την απομακρυσμένη πρόσβαση.',
  // Ownership and the locked card (only the account that set remote access up can view or change it).
  'settings.remote.ownerNote':
    'Μόνο ο λογαριασμός σου μπορεί να δει ή να αλλάξει αυτές τις ρυθμίσεις. Οι άλλοι λογαριασμοί σε αυτόν τον υπολογιστή δεν βλέπουν αυτή την κάρτα.',
  'settings.remote.setupOwnerNote':
    'Ο λογαριασμός που θα αποθηκεύσει αυτές τις ρυθμίσεις γίνεται ο μόνος λογαριασμός σε αυτόν τον υπολογιστή που μπορεί να τις δει ή να τις αλλάξει.',
  'settings.remote.currentTitle': 'Τρέχουσες ρυθμίσεις',
  'settings.remote.summary.state': 'Απομακρυσμένη πρόσβαση',
  'settings.remote.summary.on': 'Ενεργή',
  'settings.remote.summary.off': 'Ανενεργή',
  'settings.remote.summary.tokenSaved': 'Αποθηκευμένο (κρυπτογραφημένο, δεν εμφανίζεται ποτέ)',
  'settings.remote.summary.upnp': 'Άνοιγμα θύρας δρομολογητή',
  'settings.remote.summary.upnpAuto': 'Αυτόματα (UPnP)',
  'settings.remote.summary.upnpManual': 'Χειροκίνητα, στις ρυθμίσεις του δρομολογητή',
  'settings.remote.lockedHint':
    'Οι ρυθμίσεις είναι κλειδωμένες. Για να τις αλλάξεις, επίλεξε «Αλλαγή ρυθμίσεων» και πληκτρολόγησε τον κωδικό του λογαριασμού σου.',
  'settings.remote.change': 'Αλλαγή ρυθμίσεων',
  'settings.remote.unlockTitle': 'Αλλαγή ρυθμίσεων απομακρυσμένης πρόσβασης',
  'settings.remote.unlockMessage':
    'Για την προστασία του ημερολογίου σου, πληκτρολόγησε τον κωδικό του λογαριασμού σου πριν αλλάξεις από πού και πώς είναι προσβάσιμο μέσω διαδικτύου.',
  'settings.remote.unlocked': 'Οι ρυθμίσεις είναι ανοιχτές για επεξεργασία. Άλλαξε τα στοιχεία και μετά επίλεξε «Αποθήκευση στοιχείων».',
  'settings.remote.editCancelled': 'Δεν έγιναν αλλαγές. Οι ρυθμίσεις κλειδώθηκαν ξανά.',
  'settings.remote.savedLocked': 'Οι ρυθμίσεις απομακρυσμένης πρόσβασης αποθηκεύτηκαν και κλειδώθηκαν ξανά.',
  'settings.remote.password': 'Ο κωδικός του λογαριασμού σου',
  'settings.remote.passwordHint':
    'Απαιτείται για την αποθήκευση. Από εκεί και πέρα μόνο αυτός ο λογαριασμός μπορεί να δει ή να αλλάξει την απομακρυσμένη πρόσβαση.',
  'settings.remote.passwordMissing': 'Πληκτρολόγησε τον κωδικό του λογαριασμού σου.',
  'settings.remote.wrongPassword': 'Ο κωδικός πρόσβασης είναι λανθασμένος.',
  // E-mail for password reset (src/pages/settings/MailSection.tsx; owner-only, locked after setup, like remote access).
  'settings.mail.title': 'E-mail για επαναφορά κωδικού',
  'settings.mail.intro':
    'Όταν κάποιος ξεχνά τον κωδικό του, το ημερολόγιο του στέλνει με e-mail έναν σύνδεσμο και έναν κωδικό για να επιλέξει νέο. Γι’ αυτό το ημερολόγιο χρειάζεται έναν λογαριασμό e-mail από τον οποίο θα στέλνει – για παράδειγμα τη διεύθυνση Gmail που δημιούργησες για το ημερολόγιο.',
  'settings.mail.ownerNote':
    'Μόνο ο λογαριασμός σου μπορεί να δει ή να αλλάξει αυτές τις ρυθμίσεις. Οι άλλοι λογαριασμοί σε αυτόν τον υπολογιστή δεν βλέπουν αυτή την κάρτα.',
  'settings.mail.setupOwnerNote':
    'Ο λογαριασμός που θα αποθηκεύσει αυτές τις ρυθμίσεις γίνεται ο μόνος λογαριασμός σε αυτόν τον υπολογιστή που μπορεί να τις δει ή να τις αλλάξει.',
  'settings.mail.switchLabel': 'Αποστολή e-mail επαναφοράς κωδικού',
  'settings.mail.switchHint':
    'Όσο αυτό είναι ενεργό, το ημερολόγιο συνδέεται στον διακομιστή αλληλογραφίας μόνο για να στείλει e-mail επαναφοράς κωδικού και δοκιμαστικά e-mail.',
  'settings.mail.detailsTitle': 'Λογαριασμός αποστολής',
  'settings.mail.address': 'Διεύθυνση Gmail',
  'settings.mail.addressHint': 'Τα e-mail στέλνονται από αυτή τη διεύθυνση, με όνομα αποστολέα «Your Personal Diary».',
  'settings.mail.addressInvalid': 'Πληκτρολόγησε μια έγκυρη διεύθυνση e-mail.',
  'settings.mail.appPassword': 'Κωδικός εφαρμογής',
  'settings.mail.appPasswordHint':
    'Ο κωδικός εφαρμογής 16 γραμμάτων που δημιούργησε η Google για το ημερολόγιο – όχι ο συνηθισμένος κωδικός σου στο Gmail. Τα κενά δεν έχουν σημασία.',
  'settings.mail.appPasswordSaved':
    'Υπάρχει αποθηκευμένος κωδικός εφαρμογής (κρυπτογραφημένος, δεν εμφανίζεται ποτέ). Άφησε το πεδίο κενό για να τον κρατήσεις.',
  'settings.mail.appPasswordMissing': 'Πληκτρολόγησε τον κωδικό εφαρμογής.',
  'settings.mail.appPasswordGmail':
    'Ένας κωδικός εφαρμογής Gmail έχει 16 γράμματα. Ο συνηθισμένος κωδικός σου στο Gmail δεν λειτουργεί εδώ.',
  'settings.mail.advanced': 'Για προχωρημένους: διακομιστής αλληλογραφίας',
  'settings.mail.host': 'Διακομιστής εξερχόμενης αλληλογραφίας (SMTP)',
  'settings.mail.hostHint': 'Για Gmail: smtp.gmail.com',
  'settings.mail.hostInvalid': 'Πληκτρολόγησε το όνομα του διακομιστή αλληλογραφίας, για παράδειγμα smtp.gmail.com.',
  'settings.mail.port': 'Θύρα',
  'settings.mail.portHint': '465 με SSL/TLS, 587 με STARTTLS',
  'settings.mail.portInvalid': 'Πληκτρολόγησε αριθμό θύρας από 1 έως 65535.',
  'settings.mail.security': 'Κρυπτογράφηση',
  'settings.mail.security.tls': 'SSL/TLS (συνήθως θύρα 465)',
  'settings.mail.security.starttls': 'STARTTLS (συνήθως θύρα 587)',
  'settings.mail.password': 'Ο κωδικός του λογαριασμού σου',
  'settings.mail.passwordHint':
    'Ο κωδικός του λογαριασμού σου στο ημερολόγιο. Απαιτείται για την αποθήκευση· από εκεί και πέρα μόνο αυτός ο λογαριασμός μπορεί να δει ή να αλλάξει αυτές τις ρυθμίσεις.',
  'settings.mail.passwordMissing': 'Πληκτρολόγησε τον κωδικό του λογαριασμού σου.',
  'settings.mail.wrongPassword': 'Ο κωδικός πρόσβασης είναι λανθασμένος.',
  'settings.mail.saved': 'Οι ρυθμίσεις e-mail αποθηκεύτηκαν.',
  'settings.mail.savedLocked': 'Οι ρυθμίσεις e-mail αποθηκεύτηκαν και κλειδώθηκαν.',
  'settings.mail.enabled':
    'Η αποστολή e-mail επαναφοράς κωδικού είναι ενεργή. Επίλεξε «Αποστολή δοκιμαστικού e-mail» για να την ελέγξεις.',
  'settings.mail.disabled': 'Η αποστολή e-mail επαναφοράς κωδικού είναι ανενεργή.',
  'settings.mail.notReady':
    'Δεν μπορούν ακόμη να σταλούν e-mail: τα στοιχεία είναι ελλιπή. Επίλεξε «Αλλαγή ρυθμίσεων» για να τα συμπληρώσεις.',
  'settings.mail.currentTitle': 'Τρέχουσες ρυθμίσεις',
  'settings.mail.summary.state': 'Αποστολή e-mail επαναφοράς',
  'settings.mail.summary.on': 'Ενεργή',
  'settings.mail.summary.off': 'Ανενεργή',
  'settings.mail.summary.address': 'Αποστολή από',
  'settings.mail.summary.appPassword': 'Κωδικός εφαρμογής',
  'settings.mail.summary.appPasswordSaved': 'Αποθηκευμένος (κρυπτογραφημένος, δεν εμφανίζεται ποτέ)',
  'settings.mail.summary.server': 'Διακομιστής αλληλογραφίας',
  'settings.mail.summary.serverValue': '{host}, θύρα {port}, {security}',
  'settings.mail.lockedHint':
    'Οι ρυθμίσεις είναι κλειδωμένες. Για να τις αλλάξεις, επίλεξε «Αλλαγή ρυθμίσεων» και πληκτρολόγησε τον κωδικό του λογαριασμού σου.',
  'settings.mail.change': 'Αλλαγή ρυθμίσεων',
  'settings.mail.unlockTitle': 'Αλλαγή ρυθμίσεων e-mail',
  'settings.mail.unlockMessage':
    'Για την προστασία του ημερολογίου σου, πληκτρολόγησε τον κωδικό του λογαριασμού σου πριν αλλάξεις τον λογαριασμό από τον οποίο το ημερολόγιο στέλνει e-mail.',
  'settings.mail.unlocked':
    'Οι ρυθμίσεις είναι ανοιχτές για επεξεργασία. Άλλαξε τα στοιχεία και μετά επίλεξε «Αποθήκευση στοιχείων».',
  'settings.mail.editCancelled': 'Δεν έγιναν αλλαγές. Οι ρυθμίσεις κλειδώθηκαν ξανά.',
  'settings.mail.test': 'Αποστολή δοκιμαστικού e-mail',
  'settings.mail.testHint': 'Στέλνει ένα σύντομο e-mail στη δική σου διεύθυνση: {email}.',
  'settings.mail.testNoEmail':
    'Ο λογαριασμός σου δεν έχει ακόμη διεύθυνση e-mail. Πρόσθεσε μία στην κάρτα «Λογαριασμός» για να λάβεις το δοκιμαστικό e-mail.',
  'settings.mail.testSent':
    'Στάλθηκε δοκιμαστικό e-mail στη διεύθυνση {email}. Έλεγξε τα εισερχόμενα (και τον φάκελο ανεπιθύμητων).',
  'settings.mail.testFailed': 'Δεν ήταν δυνατή η αποστολή του δοκιμαστικού e-mail. {message}',
  'settings.mail.instructionsTitle': 'Πώς θα πάρεις κωδικό εφαρμογής Gmail',
  'settings.mail.instructions.signIn':
    'Συνδέσου στο myaccount.google.com με τον λογαριασμό Gmail από τον οποίο θα στέλνει το ημερολόγιο.',
  'settings.mail.instructions.twoStep':
    'Άνοιξε την «Ασφάλεια» και ενεργοποίησε την Επαλήθευση σε δύο βήματα. Η Google δίνει κωδικούς εφαρμογών μόνο σε λογαριασμούς με Επαλήθευση σε δύο βήματα.',
  'settings.mail.instructions.create':
    'Άνοιξε το myaccount.google.com/apppasswords (ή αναζήτησε «Κωδικοί πρόσβασης εφαρμογών» στον Λογαριασμό σου Google), πληκτρολόγησε ένα όνομα όπως «Your Personal Diary» και επίλεξε «Δημιουργία».',
  'settings.mail.instructions.copy':
    'Η Google εμφανίζει μία μόνο φορά έναν κωδικό 16 γραμμάτων. Πληκτρολόγησέ τον εδώ στο πεδίο «Κωδικός εφαρμογής» (τα κενά δεν έχουν σημασία), πληκτρολόγησε τον κωδικό του λογαριασμού σου και επίλεξε «Αποθήκευση».',
  'settings.mail.instructions.test':
    'Επίλεξε «Αποστολή δοκιμαστικού e-mail» και έλεγξε ότι φτάνει στα εισερχόμενά σου.',
  'settings.mail.whyAppPassword':
    'Γιατί κωδικός εφαρμογής; Η Google απορρίπτει τον συνηθισμένο κωδικό του Gmail στα προγράμματα αλληλογραφίας, γι’ αυτό δεν λειτουργεί εδώ. Ένας κωδικός εφαρμογής χρησιμοποιείται μόνο για την αλληλογραφία και μπορείς να τον ανακαλέσεις ανά πάσα στιγμή από τον Λογαριασμό σου Google.',
  'settings.mail.privacyNote':
    'Ο κωδικός εφαρμογής αποθηκεύεται κρυπτογραφημένος σε αυτόν τον υπολογιστή και δεν εμφανίζεται ξανά. Τα e-mail περιέχουν μόνο τον σύνδεσμο και τον κωδικό επαναφοράς – ποτέ τίποτα από το ημερολόγιό σου.',

  // Your Personal Diary server (src/pages/settings/PrivacySection.tsx; the published apps, the web UI it serves)
  'settings.hosted.reassurance': 'Το ημερολόγιό σου αποθηκεύεται στον διακομιστή Your Personal Diary και κρυπτογραφείται με τον κωδικό σου.',
  'settings.hosted.serverAddress': 'Διακομιστής ημερολογίου: {host}',
  'settings.hosted.offlineHint': 'Όταν είναι ενεργή, η ίδια η εφαρμογή δεν μπορεί να ανοίξει καμία σύνδεση δικτύου εκτός από τον διακομιστή του ημερολογίου.',
  // Server card (src/pages/settings/ServerSection.tsx): hosted server, its owner only (docs/android-tasks/SERVER-CARD.md)
  'settings.server.title': 'Διακομιστής',
  'settings.server.intro': 'Η κατάσταση του διακομιστή του Your Personal Diary. Μόνο εσύ, ως ιδιοκτήτης, βλέπεις αυτή την κάρτα.',
  'settings.server.refresh': 'Ανανέωση',
  'settings.server.refreshed': 'Η κατάσταση του διακομιστή ενημερώθηκε.',
  'settings.server.version': 'Έκδοση',
  'settings.server.uptime': 'Χρόνος λειτουργίας',
  'settings.server.accounts': 'Λογαριασμοί',
  'settings.server.accountsValue': '{count} από το πολύ {max}',
  'settings.server.registrations': 'Νέοι λογαριασμοί τις τελευταίες 24 ώρες',
  'settings.server.disk': 'Δίσκος',
  'settings.server.diskValue': '{used} σε χρήση, {free} ελεύθερα ({percent})',
  'settings.server.diskLow':
    'Μόνο το {percent} του δίσκου είναι ελεύθερο. Μεγάλωσε σύντομα τον τόμο (fly volumes extend, δες το εγχειρίδιο λειτουργίας): όταν ο δίσκος γεμίσει, οι αλλαγές δεν μπορούν πια να αποθηκευτούν.',
  'settings.server.storage': 'Αποθήκευση στον δίσκο',
  'settings.server.storageOk': 'Κανονική',
  'settings.server.storageFailed': 'Μη κανονική - η αποθήκευση αποτυγχάνει',
  'settings.server.storageAlert':
    'Ο διακομιστής δεν μπορεί αυτή τη στιγμή να αποθηκεύσει αλλαγές στον δίσκο του. Έλεγξε τον ελεύθερο χώρο και το αρχείο καταγραφής (δες το εγχειρίδιο λειτουργίας).',
  'settings.server.lastSave': 'Τελευταία επιτυχής αποθήκευση',
  'settings.server.noSaveYet': 'Καμία από την εκκίνηση του διακομιστή',
  'settings.server.memory': 'Μνήμη σε χρήση',
  'settings.server.gigabytes': '{value} GB',
  'settings.server.lastArchive': 'Τελευταία αρχειοθέτηση διακομιστή',
  'settings.server.noArchive': 'Καμία ακόμη',
  'settings.server.archiveDueNone':
    'Δεν υπάρχει ακόμη αρχειοθέτηση του διακομιστή. Ετοίμασε μία παρακάτω και κατέβασέ τη στον υπολογιστή σου.',
  'settings.server.archiveDueOld':
    'Η τελευταία αρχειοθέτηση του διακομιστή είναι παλαιότερη από {days} ημέρες. Ετοίμασε μια νέα παρακάτω και κατέβασέ τη στον υπολογιστή σου.',
  'settings.server.archive.title': 'Αρχειοθέτηση διακομιστή',
  'settings.server.archive.intro':
    'Ένα κρυπτογραφημένο αντίγραφο όλων των δεδομένων του διακομιστή, για την αποκατάστασή του μετά από καταστροφή. Γράφεται στον δίσκο του διακομιστή, ο οποίος κρατά τις 2 πιο πρόσφατες· έπειτα την κατεβάζεις στον υπολογιστή σου με μια εντολή στο δικό σου παράθυρο PowerShell. Δεν μπορεί ποτέ να κατέβει μέσω του ιστότοπου ή της εφαρμογής.',
  'settings.server.archive.listTitle': 'Αρχειοθετήσεις στον διακομιστή',
  'settings.server.archive.created': 'Ετοιμάστηκε',
  'settings.server.archive.size': 'Μέγεθος',
  'settings.server.archive.download': 'Εντολή λήψης',
  'settings.server.archive.check': 'Εντολή ελέγχου',
  'settings.server.archive.copyDownload': 'Αντιγραφή της εντολής λήψης',
  'settings.server.archive.copyCheck': 'Αντιγραφή της εντολής ελέγχου',
  'settings.server.archive.copied': 'Η εντολή αντιγράφηκε.',
  'settings.server.archive.copyFailed': 'Η αντιγραφή απέτυχε. Επίλεξε την εντολή και αντίγραψέ τη χειροκίνητα.',
  'settings.server.archive.stepsTitle': 'Πώς κατεβάζεις την αρχειοθέτηση',
  'settings.server.archive.step.open': 'Στον υπολογιστή σου, άνοιξε το PowerShell στον φάκελο όπου θέλεις να κρατήσεις το αρχείο.',
  'settings.server.archive.step.download': 'Επικόλλησε την εντολή λήψης και πάτησε Enter.',
  'settings.server.archive.step.check':
    'Επικόλλησε την εντολή ελέγχου και πάτησε Enter. Πρέπει να εμφανίσει True· αλλιώς κατέβασε ξανά το αρχείο.',
  'settings.server.archive.step.keep':
    'Κράτα το αρχείο εκτός σύνδεσης (π.χ. σε εξωτερικό δίσκο) και τη φράση πρόσβασης σε άλλο ασφαλές μέρος.',
  'settings.server.archive.prepare': 'Ετοιμασία αρχειοθέτησης διακομιστή',
  'settings.server.archive.formTitle': 'Ετοιμασία νέας αρχειοθέτησης',
  'settings.server.archive.password': 'Ο κωδικός του λογαριασμού σου',
  'settings.server.archive.passphrase': 'Φράση πρόσβασης της αρχειοθέτησης',
  'settings.server.archive.passphraseHint':
    'Τουλάχιστον {min} χαρακτήρες. Όχι ο κωδικός του λογαριασμού σου: διάλεξε μια ξεχωριστή και σημείωσέ τη.',
  'settings.server.archive.passphraseRepeat': 'Η φράση πρόσβασης ξανά',
  'settings.server.archive.passphraseWarning':
    'Η φράση πρόσβασης χρειάζεται για την αποκατάσταση της αρχειοθέτησης και δεν μπορεί να ανακτηθεί.',
  'settings.server.archive.passwordMissing': 'Πληκτρολόγησε τον κωδικό του λογαριασμού σου.',
  'settings.server.archive.passphraseShort': 'Η φράση πρόσβασης της αρχειοθέτησης πρέπει να έχει τουλάχιστον {min} χαρακτήρες.',
  'settings.server.archive.passphraseLong': 'Η φράση πρόσβασης της αρχειοθέτησης μπορεί να έχει το πολύ {max} χαρακτήρες.',
  'settings.server.archive.passphraseMismatch': 'Οι δύο φράσεις πρόσβασης δεν είναι ίδιες.',
  'settings.server.archive.submit': 'Ετοιμασία αρχειοθέτησης',
  'settings.server.archive.preparing': 'Η αρχειοθέτηση ετοιμάζεται. Μπορεί να πάρει ένα λεπτό - κράτα αυτή τη σελίδα ανοιχτή.',
  'settings.server.archive.ready': 'Η αρχειοθέτηση {name} ({size}) είναι έτοιμη. Κατέβασέ τη τώρα με την εντολή παρακάτω.',
  'settings.server.archive.busy': 'Αυτή τη στιγμή ετοιμάζεται μια αρχειοθέτηση.',
  'settings.server.archive.nextAt': 'Η επόμενη αρχειοθέτηση μπορεί να γίνει από τις {time}.',
  // Deletion request by e-mail (src/pages/settings/DeletionRequest.tsx, docs/android-tasks/ADMIN-TOOL.md item 3): the card builds two commands and sends nothing
  'settings.server.deletion.title': 'Αίτημα διαγραφής μέσω e-mail',
  'settings.server.deletion.intro':
    'Για κάποιον που δεν μπορεί να συνδεθεί και ζητά μέσω e-mail τη διαγραφή του λογαριασμού του. Η ίδια η εφαρμογή δεν μπορεί να αναζητήσει ή να διαγράψει λογαριασμούς: πληκτρολόγησε εδώ τη διεύθυνση και η κάρτα φτιάχνει δύο εντολές για το PowerShell στον υπολογιστή σου, που λειτουργούν μόνο με τη σύνδεσή σου στο Fly. Τίποτα από όσα πληκτρολογείς εδώ δεν αποστέλλεται πουθενά.',
  'settings.server.deletion.check': 'Έλεγξε ότι το αίτημα ήρθε από τη διεύθυνση που είναι καταχωρισμένη στον λογαριασμό.',
  'settings.server.deletion.email': 'Διεύθυνση e-mail του αιτούντος',
  'settings.server.deletion.waiting': 'Οι εντολές εμφανίζονται εδώ μόλις πληκτρολογήσεις μια πλήρη διεύθυνση e-mail.',
  'settings.server.deletion.encoded':
    'Αυτή η διεύθυνση έχει χαρακτήρες που θα άλλαζε το PowerShell, γι’ αυτό οι εντολές τη μεταφέρουν κωδικοποιημένη (b64:...). Το εργαλείο την αποκωδικοποιεί.',
  'settings.server.deletion.find': 'Βήμα 1: εύρεση του λογαριασμού',
  'settings.server.deletion.findHint':
    'Επικόλλησέ την στο PowerShell και πάτησε Enter. Δεν αλλάζει τίποτα: δείχνει το όνομα χρήστη του λογαριασμού, τη διεύθυνση e-mail, την ημερομηνία εγγραφής και το μέγεθος του ημερολογίου.',
  'settings.server.deletion.copyFind': 'Αντιγραφή της εντολής αναζήτησης',
  'settings.server.deletion.username': 'Όνομα χρήστη που έδειξε η εντολή αναζήτησης',
  'settings.server.deletion.usernameHint': 'Πληκτρολόγησέ το ακριβώς όπως εμφανίστηκε. Τότε η εντολή διαγραφής εμφανίζεται από κάτω.',
  'settings.server.deletion.usernameInvalid':
    'Αυτό δεν είναι όνομα χρήστη: ένα όνομα χρήστη έχει 3 έως 32 γράμματα, ψηφία, τελείες, παύλες ή κάτω παύλες.',
  'settings.server.deletion.delete': 'Βήμα 2: διαγραφή του λογαριασμού',
  'settings.server.deletion.deleteHint':
    'Εκτέλεσέ την μόνο αφού ελέγξεις τη διεύθυνση. Διαγράφει οριστικά τον λογαριασμό και το ημερολόγιό του, και αυτό δεν αναιρείται. Σημείωσε στο αρχείο σου την ημερομηνία που τυπώνει.',
  'settings.server.deletion.copyDelete': 'Αντιγραφή της εντολής διαγραφής',
};
export default messages;
