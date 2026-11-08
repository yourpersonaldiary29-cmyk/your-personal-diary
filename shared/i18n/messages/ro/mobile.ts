/** ro - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Mai mult',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Omite - vreau doar să arunc o privire',
  'mobile.guest.skipHint': 'Explorează aplicația cu date de exemplu. Nimic din ce scrii nu se salvează.',
  'mobile.guest.started': 'Modul tur: vezi date de exemplu. Nimic din ce scrii nu se salvează.',
  'mobile.guest.name': 'oaspete',
  'mobile.guest.banner': 'Modul tur - nimic din ce scrii nu se salvează.',
  'mobile.guest.createAccount': 'Creează un cont',
  'mobile.guest.endTour': 'Încheie turul',
  'mobile.guest.ended': 'Turul s-a încheiat.',
  'mobile.guest.unavailable': 'Modul tur nu este disponibil în această versiune.',
  'mobile.guest.settingsTitle': 'Modul tur',
  'mobile.guest.settingsText':
    'Setările pentru cont, securitate și backup nu sunt disponibile în modul tur. Creează un cont pentru a le folosi.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Salvează pe dispozitiv',
  'mobile.files.share': 'Distribuie',
  'mobile.files.saved': 'Salvat pe dispozitiv: {fileName}',
  'mobile.files.shared': 'Distribuit: {fileName}',
  'mobile.files.openedBackup': 'A fost deschis un fișier de copie de rezervă: {fileName}. Verificați-l, introduceți parola lui și confirmați restaurarea.',
  'mobile.files.readFailed': 'Fișierul deschis nu a putut fi citit.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Mementouri pentru obiceiuri',
  'mobile.reminders.channelDescription': 'Mementouri la orele pe care le-ați stabilit pentru obiceiurile dvs.',
  'mobile.reminders.genericBody': 'E timpul pentru unul dintre obiceiurile dvs.',
  'mobile.reminders.permissionText': 'Pentru a vă aminti și când aplicația este închisă, telefonul trebuie să permită notificările pentru Your Personal Diary. Mementourile sunt create pe telefon - nimic nu îl părăsește.',
  'mobile.reminders.allow': 'Permite notificările',
  'mobile.reminders.granted': 'Notificările sunt permise. Mementourile sosesc chiar și cu aplicația închisă, de obicei în câteva minute de la ora stabilită.',
  'mobile.reminders.denied': 'Notificările sunt dezactivate pentru această aplicație. Până le activați în setările telefonului (Aplicații → Your Personal Diary → Notificări), mementourile apar doar cât timp aplicația este deschisă.',
  'mobile.reminders.showNames': 'Afișează numele obiceiurilor în notificări',
  'mobile.reminders.showNamesHint': 'Dezactivat: notificarea spune doar că e timpul pentru un obicei. Activat: se afișează numele obiceiului - și pe ecranul de blocare.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Blochează când părăsesc aplicația',
  'mobile.security.lockOnLeaveHint': 'Jurnalul se blochează când treceți la altă aplicație sau când ecranul se stinge; parola dvs. îl deschide din nou.',
  'mobile.security.privacyScreen': 'Ascunde conținutul în aplicațiile recente și blochează capturile de ecran',
  'mobile.security.privacyScreenHint': 'Aplicația apare ca un card gol în ecranul aplicațiilor recente, iar capturile de ecran ale ei sunt blocate.',
  'mobile.security.biometric': 'Deblocare cu amprentă sau față',
  'mobile.security.biometricHint': 'Doar pentru ecranul de blocare. Autentificarea și confirmarea modificărilor sensibile cer întotdeauna parola.',
  'mobile.security.biometricUnavailable': 'Pe acest telefon nu este configurată deblocarea cu amprentă sau față.',
  'mobile.security.saved': 'Setare salvată.',
  'mobile.lock.biometric': 'Deblocare cu amprentă sau față',
  'mobile.lock.biometricTitle': 'Deblocați Your Personal Diary',
  'mobile.lock.usePassword': 'Folosește parola',
  'mobile.lock.biometricFailed': 'Deblocarea biometrică nu a reușit. Introduceți parola.',
};
export default messages;
