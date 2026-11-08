/** de - mobile messages: the Android shell and the tour mode. Keys are prefixed 'mobile.'. */
const messages: Record<string, string> = {
  // Android shell (src/components/layout/MobileShell.tsx, BottomNav.tsx, MoreSheet.tsx) ---------------
  'mobile.nav.more': 'Mehr',

  // Tour mode: the "Skip" button, the banner and the settings card (guest account, nothing is saved) --
  'mobile.guest.skip': 'Überspringen - nur umsehen',
  'mobile.guest.skipHint': 'Sieh dir die App mit Beispieldaten an. Nichts, was du schreibst, wird gespeichert.',
  'mobile.guest.started': 'Rundgang-Modus: Du siehst Beispieldaten. Nichts, was du schreibst, wird gespeichert.',
  'mobile.guest.name': 'Gast',
  'mobile.guest.banner': 'Rundgang-Modus - nichts, was du schreibst, wird gespeichert.',
  'mobile.guest.createAccount': 'Konto erstellen',
  'mobile.guest.endTour': 'Rundgang beenden',
  'mobile.guest.ended': 'Der Rundgang ist beendet.',
  'mobile.guest.unavailable': 'Der Rundgang-Modus ist in dieser Version nicht verfügbar.',
  'mobile.guest.settingsTitle': 'Rundgang-Modus',
  'mobile.guest.settingsText':
    'Die Einstellungen für Konto, Sicherheit und Backup sind im Rundgang-Modus nicht verfügbar. Erstelle ein Konto, um sie zu nutzen.',

  // Files on the phone (WP-7): "Save to device" / "Share" of backups and exports, an opened .mpd file ---
  'mobile.files.saveToDevice': 'Auf dem Gerät speichern',
  'mobile.files.share': 'Teilen',
  'mobile.files.saved': 'Auf dem Gerät gespeichert: {fileName}',
  'mobile.files.shared': 'Geteilt: {fileName}',
  'mobile.files.openedBackup': 'Eine Sicherungsdatei wurde geöffnet: {fileName}. Prüfen Sie sie, geben Sie ihr Passwort ein und bestätigen Sie die Wiederherstellung.',
  'mobile.files.readFailed': 'Die geöffnete Datei konnte nicht gelesen werden.',

  // Reminders as system notifications (WP-8): channel, texts, permission, "show habit names" ------------
  'mobile.reminders.channel': 'Gewohnheits-Erinnerungen',
  'mobile.reminders.channelDescription': 'Erinnerungen zu den Zeiten, die Sie für Ihre Gewohnheiten festgelegt haben.',
  'mobile.reminders.genericBody': 'Zeit für eine Ihrer Gewohnheiten.',
  'mobile.reminders.permissionText': 'Damit das Telefon Sie auch bei geschlossener App erinnert, muss es Benachrichtigungen für Your Personal Diary erlauben. Die Erinnerungen entstehen auf dem Telefon selbst - nichts verlässt es.',
  'mobile.reminders.allow': 'Benachrichtigungen erlauben',
  'mobile.reminders.granted': 'Benachrichtigungen sind erlaubt. Erinnerungen kommen auch bei geschlossener App an, meist innerhalb weniger Minuten nach der festgelegten Zeit.',
  'mobile.reminders.denied': 'Benachrichtigungen sind für diese App ausgeschaltet. Bis Sie sie in den Telefoneinstellungen einschalten (Apps → Your Personal Diary → Benachrichtigungen), erscheinen Erinnerungen nur bei geöffneter App.',
  'mobile.reminders.showNames': 'Namen der Gewohnheiten in Benachrichtigungen anzeigen',
  'mobile.reminders.showNamesHint': 'Aus: Die Benachrichtigung sagt nur, dass es Zeit für eine Gewohnheit ist. An: Der Name der Gewohnheit wird angezeigt - auch auf dem Sperrbildschirm.',

  // Lock, privacy screen and biometrics (WP-9): Security card and lock screen ---------------------------
  'mobile.security.lockOnLeave': 'Sperren, wenn ich die App verlasse',
  'mobile.security.lockOnLeaveHint': 'Das Tagebuch wird gesperrt, wenn Sie zu einer anderen App wechseln oder der Bildschirm ausgeht; Ihr Passwort öffnet es wieder.',
  'mobile.security.privacyScreen': 'Inhalt in den letzten Apps verbergen und Screenshots blockieren',
  'mobile.security.privacyScreenHint': 'Die App erscheint in der Übersicht der letzten Apps als leere Karte, und Screenshots von ihr werden blockiert.',
  'mobile.security.biometric': 'Mit Fingerabdruck oder Gesicht entsperren',
  'mobile.security.biometricHint': 'Nur für den Sperrbildschirm. Anmelden und das Bestätigen sensibler Änderungen verlangen immer das Passwort.',
  'mobile.security.biometricUnavailable': 'Auf diesem Telefon ist kein Entsperren per Fingerabdruck oder Gesicht eingerichtet.',
  'mobile.security.saved': 'Einstellung gespeichert.',
  'mobile.lock.biometric': 'Mit Fingerabdruck oder Gesicht entsperren',
  'mobile.lock.biometricTitle': 'Your Personal Diary entsperren',
  'mobile.lock.usePassword': 'Passwort verwenden',
  'mobile.lock.biometricFailed': 'Das biometrische Entsperren hat nicht funktioniert. Geben Sie Ihr Passwort ein.',
};
export default messages;
