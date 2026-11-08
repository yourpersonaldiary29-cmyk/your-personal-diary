/** el - auth messages. Keys are prefixed 'auth.'; see shared/i18n/index.ts for the syntax. */
const messages: Record<string, string> = {
  // Field labels (src/pages/RegisterPage.tsx, LoginPage.tsx, LockScreen.tsx, ConfirmDialog) ----
  'auth.firstName': 'Όνομα',
  'auth.lastName': 'Επώνυμο',
  'auth.username': 'Όνομα χρήστη',
  'auth.email': 'E-mail',
  'auth.emailHint': 'Χρησιμοποιείται για τη σύνδεση και για την επαναφορά ξεχασμένου κωδικού πρόσβασης',
  'auth.emailInvalid': 'Η διεύθυνση e-mail δεν είναι έγκυρη',
  'auth.emailTaken': 'Σφάλμα: Αυτή η διεύθυνση e-mail είναι ήδη καταχωρισμένη.',
  'auth.usernameTaken': 'Σφάλμα: Αυτό το όνομα χρήστη χρησιμοποιείται ήδη. Επίλεξε άλλο.',
  'auth.emailNotSet': 'Δεν έχει οριστεί',
  'auth.usernameOrEmail': 'Όνομα χρήστη ή e-mail',
  'auth.password': 'Κωδικός πρόσβασης',
  'auth.confirmPassword': 'Επιβεβαίωση κωδικού πρόσβασης',
  'auth.rememberMe': 'Να με θυμάσαι',
  'auth.rememberMeHint': 'Αυτόματη σύνδεση την επόμενη φορά σε αυτή τη συσκευή',
  'auth.usernameHint': 'Γράμματα, ψηφία, τελεία, παύλα ή κάτω παύλα (3 έως 32 χαρακτήρες)',
  'auth.passwordHint': 'Τουλάχιστον {min} χαρακτήρες, με γράμματα και ψηφία',

  // Registered accounts on this computer (src/pages/LoginPage.tsx)
  'auth.registeredAccounts': 'Λογαριασμοί σε αυτόν τον υπολογιστή',
  'auth.registeredAccountsHint': 'Η επιλογή ενός ονόματος συμπληρώνει το όνομα χρήστη· μένει μόνο να πληκτρολογήσεις τον κωδικό.',
  'auth.accountOption': '{name} ({username})',
  'auth.accountSelected': 'επιλεγμένο',
  'auth.accountFilled': 'Συμπληρώθηκε το όνομα χρήστη {username}. Πληκτρολόγησε τον κωδικό πρόσβασης.',

  // Titles, buttons and links
  'auth.createAccount': 'Δημιουργία λογαριασμού',
  'auth.registerTitle': 'Εγγραφή',
  'auth.loginTitle': 'Σύνδεση',
  'auth.noAccountYet': 'Δεν έχεις ακόμη λογαριασμό;',
  // Registration checkbox (src/components/legal/PrivacyPolicyLink.tsx RegisterPrivacyConsent): {policy} = the link
  // auth.privacyConsentLink (worded to fit this sentence); auth.privacyConsentRequired shows under the unticked box
  'auth.privacyConsent': 'Έχω διαβάσει την {policy} και την αποδέχομαι',
  'auth.privacyConsentLink': 'πολιτική απορρήτου',
  'auth.privacyConsentRequired': 'Για να δημιουργήσεις λογαριασμό, επίλεξε αυτό το πλαίσιο για να επιβεβαιώσεις ότι διάβασες την πολιτική απορρήτου και την αποδέχεσαι.',
  'auth.alreadyHaveAccount': 'Έχεις ήδη λογαριασμό;',

  // Validation and session messages
  'auth.passwordsMismatch': 'Οι κωδικοί πρόσβασης δεν ταιριάζουν',
  'auth.loginRequired': 'Συνδέσου πρώτα για να συνεχίσεις στη σελίδα που ζήτησες.',
  'auth.sessionExpired': 'Η συνεδρία σου έληξε. Συνδέσου ξανά.',
  'auth.sessionEnded': 'Η συνεδρία σου τερματίστηκε. Συνδέσου ξανά.',
  'auth.loggedOut': 'Αποσυνδέθηκες από το ημερολόγιο.',
  'auth.welcomeBack': 'Γεια σου, {firstName}, η σύνδεση ολοκληρώθηκε.',
  'auth.accountCreated': 'Ο λογαριασμός σου δημιουργήθηκε. Καλώς ήρθες, {firstName}!',

  // Forgotten password (src/pages/LoginPage.tsx link, ForgotPasswordPage.tsx, ResetPasswordPage.tsx)
  'auth.forgotPasswordLink': 'Ξέχασες τον κωδικό;',
  'auth.forgot.title': 'Ξεχασμένος κωδικός πρόσβασης',
  'auth.forgot.intro':
    'Πληκτρολόγησε τη διεύθυνση e-mail με την οποία έκανες εγγραφή. Θα σου στείλουμε έναν σύνδεσμο και έναν 6ψήφιο κωδικό για να επιλέξεις νέο κωδικό πρόσβασης. Οι καταχωρίσεις του ημερολογίου σου διατηρούνται.',
  'auth.forgot.email': 'Διεύθυνση e-mail εγγραφής',
  'auth.forgot.submit': 'Αποστολή συνδέσμου επαναφοράς',
  'auth.forgot.sendAgain': 'Νέα αποστολή',
  'auth.forgot.sent': 'Αν αυτή η διεύθυνση είναι καταχωρισμένη, στείλαμε σε αυτήν έναν σύνδεσμο και έναν κωδικό.',
  'auth.forgot.sentNext':
    'Ο σύνδεσμος και ο κωδικός ισχύουν για 30 λεπτά και χρησιμοποιούνται μόνο μία φορά. Αν το e-mail δεν φτάσει μέσα σε λίγα λεπτά, έλεγξε και τον φάκελο ανεπιθύμητων.',
  'auth.forgot.notAvailable':
    'Η επαναφορά κωδικού μέσω e-mail δεν έχει ρυθμιστεί ακόμη σε αυτό το ημερολόγιο. Ο λογαριασμός στον οποίο ανήκει αυτός ο υπολογιστής μπορεί να τη ρυθμίσει στις Ρυθμίσεις, στην κάρτα «E-mail για επαναφορά κωδικού».',
  'auth.forgot.haveCode': 'Εισαγωγή του κωδικού από το e-mail',
  'auth.forgot.backToLogin': 'Επιστροφή στη σύνδεση',
  'auth.reset.title': 'Επαναφορά κωδικού πρόσβασης',
  'auth.reset.introLink':
    'Επίλεξε νέο κωδικό πρόσβασης για τον λογαριασμό σου. Οι καταχωρίσεις του ημερολογίου σου διατηρούνται και θα γίνει αποσύνδεση από όλες τις συσκευές.',
  'auth.reset.introCode':
    'Πληκτρολόγησε τη διεύθυνση e-mail εγγραφής και τον 6ψήφιο κωδικό από το e-mail και μετά επίλεξε νέο κωδικό πρόσβασης. Οι καταχωρίσεις του ημερολογίου σου διατηρούνται.',
  'auth.reset.code': 'Κωδικός από το e-mail',
  'auth.reset.codeHint': '6 ψηφία',
  'auth.reset.codeInvalid': 'Ο κωδικός έχει 6 ψηφία.',
  'auth.reset.newPassword': 'Νέος κωδικός πρόσβασης',
  'auth.reset.confirmPassword': 'Επιβεβαίωση νέου κωδικού πρόσβασης',
  'auth.reset.submit': 'Αποθήκευση νέου κωδικού',
  'auth.reset.done':
    'Ο κωδικός πρόσβασης άλλαξε και έγινε αποσύνδεση από όλες τις συσκευές. Συνδέσου με τον νέο κωδικό.',
  'auth.reset.useCode': 'Χρήση του κωδικού από το e-mail',
  'auth.reset.requestNew': 'Αίτηση νέου συνδέσμου',
};
export default messages;
